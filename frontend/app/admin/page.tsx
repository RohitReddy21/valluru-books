import { AdminEditor } from "@/components/admin-editor";
import { getContentSource, getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const content = await getSiteContent();
  const source = getContentSource();

  return <AdminEditor initialContent={content} source={source} />;
}
