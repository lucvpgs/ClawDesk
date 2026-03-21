import { redirect } from "next/navigation";
export default function RuntimeSourcesPage() {
  redirect("/settings?tab=runtime");
}
