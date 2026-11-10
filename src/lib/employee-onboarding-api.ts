
import { supabase } from "@/lib/supabase";

const BUCKET = "employee_documents";
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

type EmploymentEntry = {
  company: string;
  designation: string;
  startDate: string;
  endDate: string;
  summary: string;
};

type EmploymentDocuments = {
  resignationLetter: File | null;
  acceptanceMail: File | null;
  relievingLetter: File | null;
  experienceLetter: File | null;
};

type OnboardingInput = {
  form: Record<string, string>;
  employment: EmploymentEntry[];
  files: {
    offerLetter: File | null;
    idProof: File | null;
    signedNda: File | null;
  };
  educationFiles: File[];
  employmentDocs: EmploymentDocuments[];
};

function cleanFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function nullable(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function nullableInteger(value?: string | null): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  const number = Number(trimmed);
  if (!Number.isInteger(number)) {
    throw new Error(`Invalid year value: ${trimmed}`);
  }
  return number;
}

async function uploadDocument(
  file: File | null,
  userId: string,
  employeeName: string,
  folder: string,
): Promise<string | null> {
  if (!file) {
    console.info(`[Onboarding API] No file selected: ${folder}`);
    return null;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name} exceeds the 1 MB file limit.`);
  }

  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    throw new Error(`${file.name} must be a PDF, JPG, or PNG file.`);
  }

  const employeeFolder = cleanFileName(employeeName.trim().replace(/\s+/g, "_"));

const path =
  `${userId}/${employeeFolder}/${folder}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
 

  console.info("[Onboarding API] Uploading document.", {
    folder,
    fileName: file.name,
    sizeBytes: file.size,
  });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[Onboarding API] Storage upload failed.", {
      folder,
      code: error.name,
      message: error.message,
    });
    throw new Error(`Upload failed for ${file.name}: ${error.message}`);
  }

  console.info("[Onboarding API] Upload successful.", { folder, path });
  return path;
}

export async function createEmployeeOnboarding(
  input: OnboardingInput,
) {
  const uploadedPaths: string[] = [];
  let employeeRecordId: string | null = null;

  console.info("[Onboarding API] Starting submission.");

  try {
    // 1. Verify authenticated user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Please sign in before submitting onboarding.");
    }

    console.info("[Onboarding API] Authenticated user verified.", {
      userId: user.id,
    });

    const f = input.form;

    // 2. Validate required fields.
    if (
      !f.firstName?.trim() ||
      !f.lastName?.trim()
    ) {
      throw new Error("first name and last name are required.");
    }

    console.info("[Onboarding API] Required fields validated.");

    // 3. Upload main employee documents.
    const employeeName =
  `${f.firstName.trim()} ${f.lastName.trim()}`;

const uploadTracked = async (
  file: File | null,
  folder: string,
): Promise<string | null> => {
  const path = await uploadDocument(
    file,
    user.id,
    employeeName,
    folder,
  );

  if (path) uploadedPaths.push(path);
  return path;
};

    const offerLetterPath = await uploadTracked(
      input.files.offerLetter,
      "offer-letters",
    );

    const idProofPath = await uploadTracked(
      input.files.idProof,
      "id-proofs",
    );

    const signedNdaPath = await uploadTracked(
      input.files.signedNda,
      "signed-nda",
    );

    // 4. Upload education documents.
    console.info("[Onboarding API] Uploading education documents.", {
      count: input.educationFiles.length,
    });

    const educationPaths: { name: string; path: string }[] = [];

    for (const file of input.educationFiles) {
      const path = await uploadTracked(file, "education");
      if (path) {
        educationPaths.push({ name: file.name, path });
      }
    }

    // 5. Upload documents for each previous job.
    const previousJobs = [];

    for (let index = 0; index < input.employment.length; index++) {
      const job = input.employment[index];
      const docs = input.employmentDocs[index];

      const hasDetails = [
        job.company,
        job.designation,
        job.startDate,
        job.endDate,
        job.summary,
      ].some((value) => value.trim());

      // Ignore empty employment rows.
      if (!hasDetails) continue;

      if (
        !job.company.trim() ||
        !job.designation.trim() ||
        !job.startDate ||
        !job.endDate
      ) {
        throw new Error(
          `Complete company, designation, start date and end date for previous employment ${index + 1}.`,
        );
      }

      if (job.endDate < job.startDate) {
        throw new Error(
          `End date cannot be before start date for previous employment ${index + 1}.`,
        );
      }

      const jobFolder = `previous-employment/${index + 1}`;

      const resignationLetterPath = await uploadTracked(
        docs?.resignationLetter ?? null,
        jobFolder,
      );

      const acceptanceMailPath = await uploadTracked(
        docs?.acceptanceMail ?? null,
        jobFolder,
      );

      const relievingLetterPath = await uploadTracked(
        docs?.relievingLetter ?? null,
        jobFolder,
      );

      const experienceLetterPath = await uploadTracked(
        docs?.experienceLetter ?? null,
        jobFolder,
      );

      previousJobs.push({
        company: job.company.trim(),
        designation: job.designation.trim(),
        start_date: job.startDate,
        end_date: job.endDate,
        summary: nullable(job.summary),
        resignation_letter_path: resignationLetterPath,
        acceptance_mail_path: acceptanceMailPath,
        relieving_letter_path: relievingLetterPath,
        experience_letter_path: experienceLetterPath,
      });
    }

    console.info("[Onboarding API] Document uploads completed.", {
      totalUploaded: uploadedPaths.length,
      educationDocuments: educationPaths.length,
      previousJobs: previousJobs.length,
    });

    // 6. Insert employee data using individual database columns.
    console.info("[Onboarding API] Inserting employee record.", {
      employeeId: f.employeeId.trim(),
    });

    const { data: employee, error: employeeError } = await supabase
      .from("employee_onboarding")
      .insert({
        //employee_id: f.employeeId.trim(),
        first_name: f.firstName.trim(),
        last_name: f.lastName.trim(),
        business_email: nullable(f.businessEmail),

        gender: nullable(f.gender),
        date_of_birth: nullable(f.dob),
        personal_email: nullable(f.personalEmail),
        phone: nullable(f.phone),
        blood_group: nullable(f.bloodGroup),
        emergency_phone: nullable(f.emergencyPhone),
        address: nullable(f.address),

        join_date: nullable(f.joinDate),
        designation: nullable(f.designation),
        role_type: nullable(f.roleType),
        department: nullable(f.department),

        id_proof_type: nullable(f.idProofType),
        offer_letter_path: offerLetterPath,
        id_proof_path: idProofPath,
        signed_nda_path: signedNdaPath,

        qualification: nullable(f.qualification),
        specialization: nullable(f.specialization),
        institution: nullable(f.institution),
        graduation_year: nullableInteger(f.graduationYear),

        tenth_school: nullable(f.tenthSchool),
        tenth_board: nullable(f.tenthBoard),
        tenth_passing_year: nullableInteger(f.tenthPassingYear),
        tenth_percentage: nullable(f.tenthPercentage),

        twelfth_school: nullable(f.twelfthSchool),
        twelfth_board: nullable(f.twelfthBoard),
        twelfth_passing_year: nullableInteger(f.twelfthPassingYear),
        twelfth_percentage: nullable(f.twelfthPercentage),

        additional_education_details: nullable(f.educationDetails),

        account_holder: nullable(f.accountHolder),
        bank_name: nullable(f.bankName),
        account_number: nullable(f.accountNumber),
        ifsc: nullable(f.ifsc),

        status: "submitted",
        created_by: user.id,
      })
      .select("id, employee_id, status, created_at")
      .single();
      console.log("Employee record insertion result:", { employee, employeeError });
      console.log("data to be inserted:", {
        employee_id: f.employeeId.trim(),
        first_name: f.firstName.trim(),
        last_name: f.lastName.trim(),
        business_email: nullable(f.businessEmail),
        gender: nullable(f.gender),
        date_of_birth: nullable(f.dob),
        personal_email: nullable(f.personalEmail),
        phone: nullable(f.phone),
        blood_group: nullable(f.bloodGroup),
        emergency_phone: nullable(f.emergencyPhone),
        address: nullable(f.address),
        join_date: nullable(f.joinDate),
        designation: nullable(f.designation),
        role_type: nullable(f.roleType),
        department: nullable(f.department),
        id_proof_type: nullable(f.idProofType),
        offer_letter_path: offerLetterPath,
        id_proof_path: idProofPath,
        signed_nda_path: signedNdaPath,
        qualification: nullable(f.qualification),
        specialization: nullable(f.specialization),
        institution: nullable(f.institution),
        graduation_year: nullableInteger(f.graduationYear),
        tenth_school: nullable(f.tenthSchool),
        tenth_board: nullable(f.tenthBoard),
        tenth_passing_year: nullableInteger(f.tenthPassingYear),
        tenth_percentage: nullable(f.tenthPercentage),
        twelfth_school: nullable(f.twelfthSchool),
        twelfth_board: nullable(f.twelfthBoard),
        twelfth_passing_year: nullableInteger(f.twelfthPassingYear),
        twelfth_percentage: nullable(f.twelfthPercentage),
        additional_education_details: nullable(f.educationDetails),
        account_holder: nullable(f.accountHolder),
        bank_name: nullable(f.bankName),
        account_number: nullable(f.accountNumber),
        ifsc: nullable(f.ifsc),
      });
      console.info("[Onboarding API] User ID for RLS:", user.id);

    if (employeeError) {
      console.error("[Onboarding API] Employee insert failed.", {
        code: employeeError.code,
        message: employeeError.message,
        details: employeeError.details,
        hint: employeeError.hint,
      });
      throw new Error(employeeError.message);
    }

    employeeRecordId = employee.id;

    console.info("[Onboarding API] Employee record created.", {
      recordId: employee.id,
      employeeId: employee.employee_id,
    });

    // 7. Insert education document paths into their own table.
    if (educationPaths.length > 0) {
      const educationRows = educationPaths.map((document) => ({
        employee_onboarding_id: employee.id,
        document_name: document.name,
        document_path: document.path,
      }));

      const { error } = await supabase
        .from("employee_education_documents")
        .insert(educationRows);

      if (error) {
        console.error("[Onboarding API] Education insert failed.", {
          code: error.code,
          message: error.message,
        });
        throw new Error(error.message);
      }

      console.info("[Onboarding API] Education documents saved.", {
        count: educationRows.length,
      });
    }

    // 8. Insert previous jobs into their own table.
    if (previousJobs.length > 0) {
      const previousJobRows = previousJobs.map((job) => ({
        employee_onboarding_id: employee.id,
        ...job,
      }));

      const { error } = await supabase
        .from("employee_previous_employment")
        .insert(previousJobRows);

      if (error) {
        console.error("[Onboarding API] Previous employment insert failed.", {
          code: error.code,
          message: error.message,
        });
        throw new Error(error.message);
      }

      console.info("[Onboarding API] Previous employment saved.", {
        count: previousJobRows.length,
      });
    }

    console.info("[Onboarding API] Submission completed successfully.", {
      recordId: employee.id,
      employeeId: employee.employee_id,
    });

    return employee;
  } catch (error) {
    console.error("[Onboarding API] Submission failed.", {
      recordId: employeeRecordId,
      message:
        error instanceof Error ? error.message : "Unknown error",
    });

    // Clean up uploaded files when the submission fails.
    // Database rows already inserted are NOT automatically rolled back.
    if (uploadedPaths.length > 0) {
      console.warn("[Onboarding API] Cleaning up uploaded files.", {
        count: uploadedPaths.length,
      });

      const { error: cleanupError } = await supabase.storage
        .from(BUCKET)
        .remove(uploadedPaths);

      if (cleanupError) {
        console.error("[Onboarding API] File cleanup failed.", {
          message: cleanupError.message,
        });
      } else {
        console.info("[Onboarding API] Uploaded files cleaned up.");
      }
    }

    throw error;
  }
}
