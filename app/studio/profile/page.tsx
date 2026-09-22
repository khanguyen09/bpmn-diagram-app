import type { Metadata } from "next";
import { OwnerProfileExperience } from "@/modules/identity-access";

export const metadata: Metadata = { title: "Tài khoản" };
export default function ProfilePage() { return <OwnerProfileExperience />; }
