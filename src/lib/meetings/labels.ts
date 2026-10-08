import type { Participant } from "@/lib/supabase/types";

export function speakerNumber(speakerKey: string) {
  const m = speakerKey.match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function participantLabel(p: Participant | null | undefined, youLabel = "Tú") {
  if (!p) return "";
  if (p.is_user && !p.name) return youLabel;
  return p.name ?? `Hablante ${speakerNumber(p.speaker_key)}`;
}

export function participantById(participants: Participant[], id: string | null | undefined) {
  if (!id) return null;
  return participants.find((p) => p.id === id) ?? null;
}

export function sortParticipants(participants: Participant[]) {
  return [...participants].sort((a, b) => Number(b.is_user) - Number(a.is_user) || speakerNumber(a.speaker_key) - speakerNumber(b.speaker_key));
}
