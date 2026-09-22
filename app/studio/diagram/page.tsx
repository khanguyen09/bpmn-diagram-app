import { BpmnModelLibraryExperience } from "@/modules/process-modeling";

export default async function DiagramPage({
  searchParams = Promise.resolve({}),
}: {
  readonly searchParams?: Promise<{ readonly create?: string | string[] }>;
}) {
  const requestedCreateIntent = (await searchParams).create;
  return (
    <BpmnModelLibraryExperience
      initialCreateIntent={
        requestedCreateIntent === "swimlane" ? "swimlane" : null
      }
    />
  );
}
