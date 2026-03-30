import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { createKudos, fetchKudosRecipients, fetchWallOfFameKudos, type KudosRecord, type ProfileRecord } from "@/lib/hrms-api";
import { canCreateKudos } from "@/lib/permissions";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";

const WallOfFame = () => {
  const { user, permissions } = useAuth();
  const canGiveKudos = canCreateKudos(permissions);
  const [showForm, setShowForm] = useState(false);
  const [kudosList, setKudosList] = useState<KudosRecord[]>([]);
  const [recipients, setRecipients] = useState<ProfileRecord[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [kudosMessage, setKudosMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadKudosData = async () => {
      setIsLoading(true);

      try {
        const [kudosRows, recipientRows] = await Promise.all([
          fetchWallOfFameKudos(),
          user && canGiveKudos ? fetchKudosRecipients(user, permissions) : Promise.resolve([]),
        ]);

        setKudosList(kudosRows);
        setRecipients(recipientRows);
      } catch (error) {
        console.error("Failed to load kudos data:", error);
        setKudosList([]);
        setRecipients([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadKudosData();
  }, [canGiveKudos, permissions, user]);

  const selectedRecipient = useMemo(
    () => recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null,
    [recipients, selectedRecipientId],
  );

  const handleGiveKudos = async () => {
    if (!selectedRecipient || !kudosMessage.trim()) {
      toast({
        title: "Missing fields",
        description: "Please select an employee and write a message.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      return;
    }

    try {
      await createKudos(user, {
        toUserId: selectedRecipient.id,
        toName: selectedRecipient.name,
        message: kudosMessage.trim(),
      });

      const latestKudos = await fetchWallOfFameKudos();
      setKudosList(latestKudos);
      setSelectedRecipientId("");
      setKudosMessage("");
      setShowForm(false);
      toast({ title: "Kudos Sent!", description: `Kudos given to ${selectedRecipient.name}.` });
    } catch (error) {
      console.error("Failed to send kudos:", error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Kudos could not be sent.",
        variant: "destructive",
      });
    }
  };

  return (
    <PageWrapper label="RECOGNITION_CENTER" title="Wall of Fame">
      {canGiveKudos && (
        <div className="flex gap-3 mb-2">
          <GlowButton onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Give Kudos"}</GlowButton>
        </div>
      )}

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="glass-card p-6 space-y-4 mb-4"
        >
          <h3 className="font-heading font-semibold text-foreground tracking-wide">NEW_KUDOS</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">EMPLOYEE</label>
              <select
                value={selectedRecipientId}
                onChange={(event) => setSelectedRecipientId(event.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select employee...</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">MESSAGE</label>
              <input
                value={kudosMessage}
                onChange={(event) => setKudosMessage(event.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                placeholder="Great work on..."
              />
            </div>
          </div>
          <GlowButton onClick={handleGiveKudos}>Send Kudos</GlowButton>
        </motion.div>
      )}

      {isLoading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kudosList.map((kudos, index) => {
            const normalizedRole = normalizeRole(kudos.fromRole);

            return (
              <motion.div
                key={kudos.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card-glow p-5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="text-sm font-heading font-semibold text-foreground">{kudos.toName}</span>
                </div>
                <p className="text-sm text-foreground/80 italic">"{kudos.message}"</p>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-primary font-heading">
                    {kudos.fromName} ({normalizedRole ? formatRoleLabel(normalizedRole) : kudos.fromRole})
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(kudos.createdAt).toISOString().split("T")[0]}</p>
                </div>
              </motion.div>
            );
          })}
          {!kudosList.length && (
            <div className="glass-card p-8 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">
              No kudos have been shared yet.
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
};

export default WallOfFame;
