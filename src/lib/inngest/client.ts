import { Inngest } from "inngest";

export const MEETING_UPLOADED = "meeting/uploaded" as const;

export type MeetingUploadedData = { meetingId: string; userId: string };

export const inngest = new Inngest({ id: "acta" });
