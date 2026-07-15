import type { Id } from "../../convex/_generated/dataModel";

// Shared by any UI that uploads a file through Convex file storage (avatar at
// signup, profile editing, server image) — one small helper rather than
// repeating the fetch/POST dance at each call site.
export async function uploadFile(uploadUrl: string, file: File): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
