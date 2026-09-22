import { notFound } from "next/navigation";
import { BpmnStudioExperience } from "@/modules/process-modeling";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ProcessModelPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  if (!UUID_PATTERN.test(modelId)) notFound();
  return <BpmnStudioExperience modelId={modelId} />;
}
