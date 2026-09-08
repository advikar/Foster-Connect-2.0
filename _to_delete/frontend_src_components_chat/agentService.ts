import { sendChat, type ChatMessageInput, type RoadmapTask } from "@/lib/api";

export async function sendMessageToAgent(message: string, history: ChatMessageInput[] = []): Promise<{ reply: string; tasks?: RoadmapTask[] }> {
  const response = await sendChat(message, history);
  return { reply: response.reply, tasks: [] };
}
