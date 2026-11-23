import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { createEmployeeOnboarding } from "@/lib/employee-onboarding-api";
import { fetchDepartments } from "@/lib/hrms-api";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  GraduationCap,
  Landmark,
  Loader2,
  Save,
  ShieldCheck,
  UserRound,
  Users,
  Upload,
  X,
} from "lucide-react";
import "./EmployeeOnboarding.css";

type FileField = "offerLetter" | "idProof" | "signedNda";
type EmploymentDocuments = {
  resignationLetter: File | null;
  acceptanceMail: File | null;
  relievingLetter: File | null;
  experienceLetter: File | null;
};
type Employment = {
  company: string;
  designation: string;
  startDate: string;
  endDate: string;
  summary: string;
};
const STORAGE_KEY = "employee_onboarding_data";
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB limit

const designations = [
  "Founder & CEO",
  "General Manager",
  "Head of Innovations",
  "Cybersecurity Analyst",
  "Cyber Security SME",
  "Operations Head & Web Dev Team Lead",
  "Sales",
  "Manager & AIML Lead",
  "Cybersecurity Intern",
  "Cyber Security",
  "Full Stack Developer",
  "AI/ML",
  "Director",
  "Manager",
  "IT Operations",
];

const roleTypes = [
  "Full-Time",
  "Internship",
  "Contract",
  "Part-Time",
  "Freelance",
];
const idProofTypes = [
  "National ID Card",
  "Driving Licence",
  "Pan Card",
  "Voter ID",
  "Passport",
];
const qualificationOptions = [
  "Class 10th / Secondary",
  "Class 12th / Higher Secondary",
  "Diploma",
  "Undergraduate (B.Tech, B.E., B.Sc, BCA, B.Com, etc.)",
  "Postgraduate (M.Tech, M.E., M.Sc, MCA, MBA, etc.)",
  "Doctorate / Ph.D.",
  "Other",
];
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const initialForm = {
  // Step 0: Personal Information
  gender: "",
  dob: "",
  personalEmail: "",
  phone: "",
  bloodGroup: "",
  emergencyPhone: "",
  address: "",

  // Step 1: Employment Details
  joinDate: "",
  employeeId: "",
  firstName: "",
  lastName: "",
  businessEmail: "",
  designation: "",
  roleType: "",
  department: "",

  // Step 2: Documents
  idProofType: "",

  // Step 3: Education Details
  qualification: "",
  specialization: "",
  institution: "",
  graduationYear: "",
  tenthSchool: "",
  tenthBoard: "",
  tenthPassingYear: "",
  tenthPercentage: "",
  twelfthSchool: "",
  twelfthBoard: "",
  twelfthPassingYear: "",
  twelfthPercentage: "",
  educationDetails: "",

  // Step 5: Bank Details
  accountHolder: "",
  ifsc: "",
  bankName: "",
  branchName: "",
  bankAddress: "",
  accountNumber: "",
  confirmAccountNumber: "",
};

type FormValues = typeof initialForm;

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  children,
  autoComplete,
  max,
  min,
  maxLength,
  readOnly = false,
  disabled = false,
}: {
  label: string;
  name: keyof FormValues;
  value: string;
  onChange: (name: keyof FormValues, value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  children?: ReactNode;
  autoComplete?: string;
  max?: string;
  min?: string;
  maxLength?: number;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="eo-field">
      <span className="eo-label">
        {label}
        {required && (
          <i aria-hidden="true" className="eo-required">
            {" "}
            *
          </i>
        )}
      </span>
      {children ?? (
        <input
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
          autoComplete={autoComplete}
          max={max}
          min={min}
          maxLength={maxLength}
          readOnly={readOnly}
          disabled={disabled}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  placeholder = "Select an option",
}: {
  label: string;
  name: keyof FormValues;
  value: string;
  onChange: (name: keyof FormValues, value: string) => void;
  options: string[];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <Field
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
    >
      <span className="eo-select-wrap">
        <select
          name={name}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
    </Field>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="eo-card">
      <div className="eo-section-heading">
        <span className="eo-section-icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="eo-grid">{children}</div>
    </section>
  );
}

function UploadField({
  label,
  file,
  onChange,
  required = false,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
}) {
  return (
    <div className="eo-upload-field">
      <span className="eo-label">
        {label}
        {required && (
          <i aria-hidden="true" className="eo-required">
            {" "}
            *
          </i>
        )}
      </span>
      <label className="eo-upload-label">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <span className="eo-file-selected">
            <FileText size={20} />
            <span className="eo-file-name">
              <strong>{file.name}</strong>
              <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
            </span>
          </span>
        ) : (
          <>
            <span className="eo-upload-icon">
              <Upload size={19} />
            </span>
            <strong>Choose a file</strong>
            <small>PDF, JPG or PNG (Max 1 MB)</small>
          </>
        )}
      </label>
      {file && (
        <button
          className="eo-remove-file"
          type="button"
          onClick={() => onChange(null)}
        >
          <X size={14} /> Remove file
        </button>
      )}
    </div>
  );
}

const defaultEmploymentDocs: EmploymentDocuments = {
  resignationLetter: null,
  acceptanceMail: null,
  relievingLetter: null,
  experienceLetter: null,
};

export default function EmployeeOnboarding() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState("");

  useEffect(() => {
    document.title = "Add Employee";
    return () => {
      document.title = "PraNaga HRMS";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDepartments()
      .then((rows) => {
        if (!cancelled) setDepartments(rows);
      })
      .catch((error) => {
        console.error("Failed to load departments:", error);
        if (!cancelled) {
          setDepartmentsError(
            error instanceof Error ? error.message : "Departments could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDepartmentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [form, setForm] = useState<FormValues>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initialForm, ...parsed.form };
      }
    } catch {
      // Ignore parse failure
    }
    return initialForm;
  });

  const [employment, setEmployment] = useState<Employment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.employment || [];
      }
    } catch {
      // Ignore parse failure
    }
    return [];
  });

  const [employmentDocs, setEmploymentDocs] = useState<EmploymentDocuments[]>(
    [],
  );

  const [activeStep, setActiveStep] = useState(0);
  const stepRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<Record<FileField, File | null>>({
    offerLetter: null,
    idProof: null,
    signedNda: null,
  });
  const [educationFiles, setEducationFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );

  const [isFetchingIfsc, setIsFetchingIfsc] = useState(false);
  const [ifscError, setIfscError] = useState("");

  useEffect(() => {
    setEmploymentDocs((prev) => {
      if (prev.length === employment.length) return prev;
      if (prev.length < employment.length) {
        const extra = Array(employment.length - prev.length).fill(
          defaultEmploymentDocs,
        );
        return [...prev, ...extra];
      }
      return prev.slice(0, employment.length);
    });
  }, [employment.length]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          form,
          employment,
        }),
      );
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }
  }, [form, employment]);

  const today = new Date();
  const maxDobDate = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  )
    .toISOString()
    .split("T")[0];
  const minDobDate = new Date(
    today.getFullYear() - 65,
    today.getMonth(),
    today.getDate(),
  )
    .toISOString()
    .split("T")[0];

  const handleIfscChange = async (ifscCode: string) => {
    const formattedCode = ifscCode.toUpperCase().trim();
    setForm((current) => ({ ...current, ifsc: formattedCode }));
    setIfscError("");

    if (formattedCode.length === 11) {
      setIsFetchingIfsc(true);
      try {
        const res = await fetch(`https://ifsc.razorpay.com/${formattedCode}`);
        if (!res.ok) {
          throw new Error("Invalid IFSC Code");
        }
        const data = await res.json();
        setForm((current) => ({
          ...current,
          bankName: data.BANK ?? "",
          branchName: data.BRANCH ?? "",
          bankAddress: data.ADDRESS ?? "",
        }));
        setIfscError("");
      } catch {
        setIfscError("Unable to fetch bank details for this IFSC.");
        setForm((current) => ({
          ...current,
          bankName: "",
          branchName: "",
          bankAddress: "",
        }));
      } finally {
        setIsFetchingIfsc(false);
      }
    }
  };

  const update = (name: keyof FormValues, value: string) => {
    if (name === "phone" || name === "emergencyPhone") {
      const numericVal = value.replace(/\D/g, "").slice(0, 10);
      setForm((current) => ({ ...current, [name]: numericVal }));
      setMessage("");
      return;
    }

    if (name === "ifsc") {
      void handleIfscChange(value);
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
    setMessage("");
  };

  const updateFile = (name: FileField, file: File | null) => {
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      setMessageType("error");
      setMessage(
        `File "${file.name}" exceeds 1 MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB). Please select a file smaller than 1 MB.`,
      );
      return;
    }
    setFiles((current) => ({ ...current, [name]: file }));
    setMessage("");
  };

  const updateEmploymentFile = (
    index: number,
    docType: keyof EmploymentDocuments,
    file: File | null,
  ) => {
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      setMessageType("error");
      setMessage(
        `File "${file.name}" exceeds 1 MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB). Please upload files under 1 MB.`,
      );
      return;
    }
    setEmploymentDocs((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [docType]: file } : item,
      ),
    );
    setMessage("");
  };

  const resetForm = () => {
    localStorage.removeItem(STORAGE_KEY);
    setForm(initialForm);
    setFiles({ offerLetter: null, idProof: null, signedNda: null });
    setEducationFiles([]);
    setEmployment([]);
    setEmploymentDocs([]);
    setActiveStep(0);
    setMessage("");
  };

  const saveDraft = () => {
    setMessageType("success");
    setMessage("Draft saved successfully to browser storage.");
  };

  const stepTitles = [
    "Personal Information",
    "Employment Details",
    "Documents",
    "Education",
    "Previous Employment",
    "Bank Details",
  ];

  const stepIcons = [
    <UserRound size={18} key="step-1" />,
    <BriefcaseBusiness size={18} key="step-2" />,
    <FileText size={18} key="step-3" />,
    <GraduationCap size={18} key="step-4" />,
    <Building2 size={18} key="step-5" />,
    <Landmark size={18} key="step-6" />,
  ];

  const goToNextStep = () => {
    setMessage("");
    setActiveStep((curr) => Math.min(curr + 1, stepTitles.length - 1));
  };

  const goToPreviousStep = () => {
    setMessage("");
    setActiveStep((curr) => Math.max(curr - 1, 0));
  };

  const handleStepClick = (index: number) => {
    setMessage("");
    setActiveStep(index);
  };

  // Comprehensive check applied ONLY on final submission
  const validateForSubmission = (
    firstName: string,
    lastName: string,
  ): boolean => {
    const fail = (text: string, targetStep: number): false => {
      setMessageType("error");
      setMessage(text);
      setActiveStep(targetStep);
      return false;
    };

    // Step 0: Personal Info Checks
    if (!form.gender?.trim()) return fail("Please select a Gender.", 0);
    if (!form.dob?.trim()) return fail("Please enter Date of Birth.", 0);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((form.personalEmail ?? "").trim())) {
      return fail("Please enter a valid Personal Email Address.", 0);
    }
    if (!/^\d{10}$/.test((form.phone ?? "").trim())) {
      return fail("Phone number must contain exactly 10 digits.", 0);
    }
    if (!form.bloodGroup?.trim())
      return fail("Please select a Blood Group.", 0);
    if (!/^\d{10}$/.test((form.emergencyPhone ?? "").trim())) {
      return fail("Emergency contact must contain exactly 10 digits.", 0);
    }

    // Step 1: Employment Details Checks (Employee ID deliberately optional)
    if (!form.joinDate?.trim())
      return fail("Please provide a Joining Date.", 1);
    if (!firstName) return fail("First Name is required.", 1);
    if (!lastName) return fail("Last Name is required.", 1);
    if (!form.designation?.trim())
      return fail("Please select a Designation.", 1);
    if (!form.roleType?.trim()) return fail("Please select a Role Type.", 1);
    if (!form.department?.trim()) return fail("Please select a Department.", 1);

    // Step 3: Education Details Checks
    if (!form.qualification?.trim()) {
      return fail("Please select the Highest Qualification.", 3);
    }

    // Step 4: Previous Employment validation (if rows exist)
    for (const item of employment) {
      const hasDetails = [
        item.company,
        item.designation,
        item.startDate,
        item.endDate,
        item.summary,
      ].some((entry) => entry?.trim());

      if (hasDetails) {
        if (
          !item.company?.trim() ||
          !item.designation?.trim() ||
          !item.startDate ||
          !item.endDate
        ) {
          return fail(
            "Complete Company, Designation, Start Date, and End Date for each added job entry.",
            4,
          );
        }
        if (item.endDate < item.startDate) {
          return fail(
            "Previous employment End Date cannot be earlier than Start Date.",
            4,
          );
        }
      }
    }

    // Step 5: Bank Details Checks (if partially filled)
    const bankFields = [
      form.accountHolder,
      form.ifsc,
      form.bankName,
      form.accountNumber,
      form.confirmAccountNumber,
    ];
    const hasAnyBankData = bankFields.some((item) => item?.trim());
    if (hasAnyBankData) {
      if (bankFields.some((item) => !item?.trim())) {
        return fail(
          "Complete all bank detail fields or leave the bank section completely blank.",
          5,
        );
      }
      if (!/^\d{9,18}$/.test((form.accountNumber ?? "").trim())) {
        return fail("Account number must be between 9 and 18 digits.", 5);
      }
      if (form.accountNumber.trim() !== form.confirmAccountNumber.trim()) {
        return fail("Bank account numbers do not match.", 5);
      }
      if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test((form.ifsc ?? "").trim())) {
        return fail(
          "Enter a valid 11-character IFSC code (e.g. HDFC0001234).",
          5,
        );
      }
    }

    return true;
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    // The form is multi-step, so fields from earlier steps are unmounted
    // when the user submits from the final step. Read their values from
    // React state instead of FormData (which only sees mounted inputs).
    const firstName = (form.firstName ?? "").trim();
    const lastName = (form.lastName ?? "").trim();

    if (!validateForSubmission(firstName, lastName)) {
      return;
    }

    try {
      // Normalize values so employeeId is null if omitted, and first/last name are clean
      const payloadForm = {
        ...form,
        firstName,
        lastName,
        employeeId: form.employeeId.trim() || "",
      };

      const result = await createEmployeeOnboarding({
        form: payloadForm,
        employment,
        files,
        educationFiles,
        employmentDocs,
      });

      setMessageType("success");
      setMessage(
        `Employee ${result.employee_id || "record"} submitted successfully.`,
      );

      localStorage.removeItem(STORAGE_KEY);
      setForm(initialForm);
      setFiles({
        offerLetter: null,
        idProof: null,
        signedNda: null,
      });
      setEducationFiles([]);
      setEmployment([]);
      setEmploymentDocs([]);
      setActiveStep(0);
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit onboarding. Please check required fields and try again.",
      );
    }
  };

  const addEmployment = () => {
    setEmployment((current) => [
      ...current,
      { company: "", designation: "", startDate: "", endDate: "", summary: "" },
    ]);
    setEmploymentDocs((current) => [...current, { ...defaultEmploymentDocs }]);
  };

  const removeEmployment = (index: number) => {
    setEmployment((current) => current.filter((_, i) => i !== index));
    setEmploymentDocs((current) => current.filter((_, i) => i !== index));
  };

  const updateEmployment = (
    index: number,
    key: keyof Employment,
    value: string,
  ) => {
    setEmployment((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  return (
    <main className="employee-onboarding">
      <div className="eo-page-top">
        <div>
          <h1>Add Employee</h1>
          <p className="eo-subtitle">
            Employee information and onboarding records
          </p>
        </div>
        <button
          className="eo-button eo-button-secondary"
          type="button"
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      {/* Step Navigation Tabs */}
      <div
        className="eo-step-tabs"
        role="tablist"
        aria-label="Employee onboarding steps"
      >
        {stepTitles.map((title, index) => (
          <button
            key={title}
            type="button"
            role="tab"
            aria-selected={activeStep === index}
            className={`eo-step-tab ${activeStep === index ? "active" : ""}`}
            onClick={() => handleStepClick(index)}
          >
            <span className="eo-step-icon">{stepIcons[index]}</span>
            <span className="eo-step-number">{index + 1}</span>
            <span className="eo-step-title">{title}</span>
          </button>
        ))}
      </div>

      <form noValidate onSubmit={submitForm}>
        {/* Step 0: Personal Information */}
        {activeStep === 0 && (
          <div ref={stepRef}>
            <Section
              icon={<UserRound size={18} />}
              title="Personal Information"
              description="Basic contact and personal details"
            >
              <SelectField
                label="Gender"
                name="gender"
                value={form.gender}
                onChange={update}
                options={[
                  "Female",
                  "Male",
                  "Non-binary",
                  "Prefer not to say",
                  "Other",
                ]}
                required
              />
              <Field
                label="Date of Birth"
                name="dob"
                value={form.dob}
                onChange={update}
                type="date"
                min={minDobDate}
                max={maxDobDate}
                required
              />
              <Field
                label="Personal Email ID"
                name="personalEmail"
                value={form.personalEmail}
                onChange={update}
                type="email"
                required
              />
              <Field
                label="Phone Number"
                name="phone"
                value={form.phone}
                onChange={update}
                type="tel"
                maxLength={10}
                placeholder="10-digit mobile number"
                autoComplete="tel"
                required
              />
              <Field
                label="Blood Group"
                name="bloodGroup"
                value={form.bloodGroup}
                onChange={update}
                required
              >
                <span className="eo-select-wrap">
                  <select
                    value={form.bloodGroup}
                    onChange={(e) => update("bloodGroup", e.target.value)}
                  >
                    <option value="">Select blood group</option>
                    {bloodGroups.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </span>
              </Field>

              <Field
                label="Emergency Contact Number"
                name="emergencyPhone"
                value={form.emergencyPhone}
                onChange={update}
                type="tel"
                maxLength={10}
                placeholder="10-digit emergency number"
                required
              />

              <div className="eo-field eo-span-2">
                <span className="eo-label">Residential Address</span>
                <textarea
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Enter full residential address"
                  rows={3}
                />
              </div>
            </Section>
          </div>
        )}

        {/* Step 1: Employment Details */}
        {activeStep === 1 && (
          <div ref={stepRef}>
            <Section
              icon={<BriefcaseBusiness size={18} />}
              title="Employment Details"
              description="Role, department and company information"
            >
              <Field
                label="Joining Date"
                name="joinDate"
                value={form.joinDate}
                onChange={update}
                type="date"
                required
              />
              {/* Employee ID: Completely optional, auto-generated placeholder */}
              <Field
                label="Employee ID"
                name="employeeId"
                value={form.employeeId}
                onChange={update}
                placeholder="Assigned by Admin"
                required={false}
                disabled
              />
              <Field
                label="First Name"
                name="firstName"
                value={form.firstName}
                onChange={update}
                autoComplete="given-name"
                required
              />
              <Field
                label="Last Name"
                name="lastName"
                value={form.lastName}
                onChange={update}
                autoComplete="family-name"
                required
              />
              <Field
                label="Business Email ID"
                name="businessEmail"
                value={form.businessEmail}
                onChange={update}
                type="email"
              />
              <Field
                label="Designation"
                name="designation"
                value={form.designation}
                onChange={update}
                required
              >
                <span className="eo-select-wrap">
                  <select
                    value={form.designation}
                    onChange={(e) => update("designation", e.target.value)}
                  >
                    <option value="">Select designation</option>
                    {designations.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </span>
              </Field>
              <SelectField
                label="Role Type"
                name="roleType"
                value={form.roleType}
                onChange={update}
                options={roleTypes}
                required
              />
              <SelectField
                label="Department"
                name="department"
                value={form.department}
                onChange={update}
                options={departments}
                placeholder={
                  departmentsLoading
                    ? "Loading departments..."
                    : departmentsError
                      ? "Departments unavailable"
                      : "Select Department"
                }
                required
              />
              {departmentsError && (
                <p className="text-sm text-red-600" role="alert">
                  Departments could not be loaded: {departmentsError}
                </p>
              )}
            </Section>
          </div>
        )}

        {/* Step 2: Documents */}
        {activeStep === 2 && (
          <div ref={stepRef}>
            <Section
              icon={<FileText size={18} />}
              title="Documents & Agreements"
              description="Accepted formats: PDF, JPG and PNG · Maximum 1 MB per file"
            >
              <UploadField
                label="Offer Letter"
                file={files.offerLetter}
                onChange={(file) => updateFile("offerLetter", file)}
              />
              <SelectField
                label="ID Proof Type"
                name="idProofType"
                value={form.idProofType}
                onChange={update}
                options={idProofTypes}
              />
              <UploadField
                label="Signed NDA"
                file={files.signedNda}
                onChange={(file) => updateFile("signedNda", file)}
              />
              <UploadField
                label="ID Proof Document"
                file={files.idProof}
                onChange={(file) => updateFile("idProof", file)}
              />
            </Section>
          </div>
        )}

        {/* Step 3: Education */}
        {activeStep === 3 && (
          <div ref={stepRef}>
            <Section
              icon={<GraduationCap size={18} />}
              title="Education"
              description="Academic qualifications and schooling details"
            >
              <SelectField
                label="Highest Qualification"
                name="qualification"
                value={form.qualification}
                onChange={update}
                options={qualificationOptions}
                placeholder="Select highest qualification"
                required
              />

              <Field
                label="Specialization / Branch"
                name="specialization"
                value={form.specialization}
                onChange={update}
                placeholder="e.g. Information Technology, Computer Science"
              />

              <Field
                label="College / University / Institution"
                name="institution"
                value={form.institution}
                onChange={update}
                placeholder="e.g. ABES Engineering College"
              />

              <Field
                label="Graduation Year"
                name="graduationYear"
                value={form.graduationYear}
                onChange={update}
                type="number"
                placeholder="YYYY"
              />

              <div className="eo-span-2 eo-sub-section">
                <h3 className="eo-sub-heading">
                  Class 10th (Secondary) Details
                </h3>
              </div>
              <Field
                label="10th School / Institute Name"
                name="tenthSchool"
                value={form.tenthSchool}
                onChange={update}
                placeholder="Enter school name"
              />
              <Field
                label="10th Board"
                name="tenthBoard"
                value={form.tenthBoard}
                onChange={update}
                placeholder="e.g. CBSE, ICSE, State Board"
              />
              <Field
                label="10th Passing Year"
                name="tenthPassingYear"
                value={form.tenthPassingYear}
                onChange={update}
                type="number"
                placeholder="YYYY"
              />
              <Field
                label="10th Percentage / CGPA"
                name="tenthPercentage"
                value={form.tenthPercentage}
                onChange={update}
                placeholder="e.g. 85% or 8.5 CGPA"
              />

              <div className="eo-span-2 eo-sub-section">
                <h3 className="eo-sub-heading">
                  Class 12th / Diploma (Higher Secondary) Details
                </h3>
              </div>
              <Field
                label="12th College / School Name"
                name="twelfthSchool"
                value={form.twelfthSchool}
                onChange={update}
                placeholder="Enter school/college name"
              />
              <Field
                label="12th Board / Council"
                name="twelfthBoard"
                value={form.twelfthBoard}
                onChange={update}
                placeholder="e.g. CBSE, ISC, State Board"
              />
              <Field
                label="12th Passing Year"
                name="twelfthPassingYear"
                value={form.twelfthPassingYear}
                onChange={update}
                type="number"
                placeholder="YYYY"
              />
              <Field
                label="12th Percentage / CGPA"
                name="twelfthPercentage"
                value={form.twelfthPercentage}
                onChange={update}
                placeholder="e.g. 78% or 7.8 CGPA"
              />

              <div className="eo-field eo-span-2">
                <span className="eo-label">
                  Education Documents (Degrees, Marksheets)
                </span>
                <label className="eo-education-upload">
                  <span className="eo-upload-icon">
                    <Upload size={19} />
                  </span>
                  <strong>Choose files</strong>
                  <span>Upload 10th, 12th, or degree marksheets</span>
                  <small>PDF, JPG or PNG · Maximum 1 MB per file</small>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(event) => {
                      const selectedFiles = Array.from(
                        event.target.files ?? [],
                      );
                      const validFiles: File[] = [];

                      for (const file of selectedFiles) {
                        if (file.size > MAX_FILE_SIZE_BYTES) {
                          setMessageType("error");
                          setMessage(
                            `File "${file.name}" exceeds 1 MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB).`,
                          );
                        } else {
                          validFiles.push(file);
                        }
                      }

                      if (validFiles.length > 0) {
                        setEducationFiles((current) => [
                          ...current,
                          ...validFiles,
                        ]);
                      }
                      event.target.value = "";
                    }}
                  />
                </label>

                {educationFiles.map((file, index) => (
                  <div
                    className="eo-file-selected"
                    key={`${file.name}-${index}`}
                  >
                    <FileText size={18} />
                    <span>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button
                      type="button"
                      className="eo-button eo-button-secondary"
                      onClick={() =>
                        setEducationFiles((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="eo-field eo-span-2">
                <span className="eo-label">Additional Education Details</span>
                <textarea
                  value={form.educationDetails}
                  onChange={(e) => update("educationDetails", e.target.value)}
                  rows={2}
                  placeholder="Certifications, honours, or other relevant academic details (optional)"
                />
              </div>
            </Section>
          </div>
        )}

        {/* Step 4: Previous Employment */}
        {activeStep === 4 && (
          <div ref={stepRef}>
            <Section
              icon={<Building2 size={18} />}
              title="Previous Employment"
              description="Optional for freshers and interns · Upload certificates (Max 1 MB each)"
            >
              {employment.map((item, index) => {
                const docs = employmentDocs[index] || defaultEmploymentDocs;

                return (
                  <div className="eo-employment-entry eo-span-2" key={index}>
                    <div className="eo-entry-heading">
                      <strong>Previous Employment {index + 1}</strong>
                      <button
                        className="eo-remove-file"
                        type="button"
                        onClick={() => removeEmployment(index)}
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>

                    <div className="eo-grid">
                      <label className="eo-field">
                        <span className="eo-label">Previous Company</span>
                        <input
                          value={item.company}
                          onChange={(e) =>
                            updateEmployment(index, "company", e.target.value)
                          }
                          placeholder="Company name"
                        />
                      </label>
                      <label className="eo-field">
                        <span className="eo-label">Previous Designation</span>
                        <input
                          value={item.designation}
                          onChange={(e) =>
                            updateEmployment(
                              index,
                              "designation",
                              e.target.value,
                            )
                          }
                          placeholder="Job title"
                        />
                      </label>
                      <label className="eo-field">
                        <span className="eo-label">Start Date</span>
                        <input
                          type="date"
                          value={item.startDate}
                          onChange={(e) =>
                            updateEmployment(index, "startDate", e.target.value)
                          }
                        />
                      </label>
                      <label className="eo-field">
                        <span className="eo-label">End Date</span>
                        <input
                          type="date"
                          value={item.endDate}
                          onChange={(e) =>
                            updateEmployment(index, "endDate", e.target.value)
                          }
                        />
                      </label>
                      <label className="eo-field eo-span-2">
                        <span className="eo-label">Experience Summary</span>
                        <textarea
                          rows={2}
                          value={item.summary}
                          onChange={(e) =>
                            updateEmployment(index, "summary", e.target.value)
                          }
                          placeholder="Responsibilities and work summary"
                        />
                      </label>

                      <div className="eo-span-2 eo-sub-section">
                        <h4 className="eo-sub-heading">
                          Employment Verification Documents
                        </h4>
                      </div>

                      <UploadField
                        label="Resignation Letter / Email"
                        file={docs.resignationLetter}
                        onChange={(file) =>
                          updateEmploymentFile(index, "resignationLetter", file)
                        }
                      />

                      <UploadField
                        label="Acceptance Mail / Letter"
                        file={docs.acceptanceMail}
                        onChange={(file) =>
                          updateEmploymentFile(index, "acceptanceMail", file)
                        }
                      />

                      <UploadField
                        label="Relieving Letter"
                        file={docs.relievingLetter}
                        onChange={(file) =>
                          updateEmploymentFile(index, "relievingLetter", file)
                        }
                      />

                      <UploadField
                        label="Experience Letter"
                        file={docs.experienceLetter}
                        onChange={(file) =>
                          updateEmploymentFile(index, "experienceLetter", file)
                        }
                      />
                    </div>
                  </div>
                );
              })}

              <div className="eo-span-2">
                <button
                  type="button"
                  className="eo-button eo-button-secondary"
                  onClick={addEmployment}
                >
                  + Add Previous Employment
                </button>
              </div>
            </Section>
          </div>
        )}

        {/* Step 5: Bank Details */}
        {activeStep === 5 && (
          <div ref={stepRef}>
            <Section
              icon={<Landmark size={18} />}
              title="Bank Details"
              description="Confidential payroll information"
            >
              <Field
                label="Account Holder Name"
                name="accountHolder"
                value={form.accountHolder}
                onChange={update}
              />

              <label className="eo-field">
                <span className="eo-label">IFSC Code</span>
                <div style={{ position: "relative" }}>
                  <input
                    name="ifsc"
                    type="text"
                    value={form.ifsc}
                    onChange={(e) => update("ifsc", e.target.value)}
                    placeholder="e.g. SBIN0000642"
                    maxLength={11}
                    style={{ textTransform: "uppercase" }}
                  />
                  {isFetchingIfsc && (
                    <span
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Loader2 size={16} className="animate-spin text-muted" />
                    </span>
                  )}
                </div>
                {ifscError && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#ef4444",
                      marginTop: "4px",
                    }}
                  >
                    {ifscError}
                  </span>
                )}
              </label>

              <Field
                label="Bank Name"
                name="bankName"
                value={form.bankName}
                onChange={update}
                placeholder="Auto-filled from IFSC"
              />

              <Field
                label="Branch Name"
                name="branchName"
                value={form.branchName}
                onChange={update}
                placeholder="Auto-filled from IFSC"
              />

              <div className="eo-field eo-span-2">
                <span className="eo-label">Bank Branch Address</span>
                <textarea
                  value={form.bankAddress}
                  onChange={(e) => update("bankAddress", e.target.value)}
                  placeholder="Auto-filled from IFSC"
                  rows={2}
                />
              </div>

              <Field
                label="Account Number"
                name="accountNumber"
                value={form.accountNumber}
                onChange={update}
              />

              <Field
                label="Confirm Account Number"
                name="confirmAccountNumber"
                value={form.confirmAccountNumber}
                onChange={update}
              />
            </Section>
          </div>
        )}

        {/* Feedback Messages */}
        {message && (
          <div className={`eo-message ${messageType}`} role="status">
            {messageType === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <ShieldCheck size={18} />
            )}
            <span>{message}</span>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="eo-step-footer">
          <button
            type="button"
            className="eo-button eo-button-secondary"
            onClick={goToPreviousStep}
            disabled={activeStep === 0}
          >
            <ArrowLeft size={16} /> Previous
          </button>
          <div className="eo-progress" aria-live="polite">
            <div className="eo-progress-dots">
              {stepTitles.map((title, index) => (
                <span
                  key={title}
                  className={`eo-progress-dot ${activeStep === index ? "active" : ""}`}
                />
              ))}
            </div>
            <span>
              Step {activeStep + 1} of {stepTitles.length}
            </span>
          </div>
          <div className="eo-step-actions">
            <button
              type="button"
              className="eo-button eo-button-ghost"
              onClick={resetForm}
            >
              Reset
            </button>
            {activeStep < stepTitles.length - 1 ? (
              <button
                type="button"
                className="eo-button eo-button-primary"
                onClick={goToNextStep}
              >
                Next <span aria-hidden="true">→</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="eo-button eo-button-secondary"
                  onClick={saveDraft}
                >
                  <Save size={16} /> Save Draft
                </button>
                <button type="submit" className="eo-button eo-button-primary">
                  <Users size={16} /> Submit Employee
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      <p className="eo-footer-note">
        HRMS · Employee records are confidential. Connect a secure backend
        before using this form for real employee data.
      </p>
    </main>
  );
}
