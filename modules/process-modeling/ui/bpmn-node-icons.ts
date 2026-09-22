import {
  BadgeCheck, Bell, Building2, CalendarDays, ChartNoAxesCombined, Clock3,
  Cloud, Code2, CreditCard, Database, FileText, Flag, Folder, Headphones,
  Image, KeyRound, Lightbulb, ListChecks, Mail, MapPin, MessageSquare,
  Package, Paperclip, Phone, Receipt, ScanSearch, Search, Send, Settings,
  ShieldCheck, Target, Truck, UserRound, UsersRound, Video, Zap,
  type LucideIcon,
} from "lucide-react";
import type { NodeIconKey } from "../domain/node-visual";

/** Local, bounded SVGs only: this map is shared by the picker and diagram overlay. */
export const nodeIconComponents = {
  person: UserRound, team: UsersRound, document: FileText, review: ScanSearch,
  approval: BadgeCheck, message: MessageSquare, search: Search, data: Database,
  settings: Settings, clock: Clock3, shield: ShieldCheck, publish: Send,
  email: Mail, phone: Phone, meeting: Video, notification: Bell,
  calendar: CalendarDays, checklist: ListChecks, folder: Folder, attachment: Paperclip,
  image: Image, idea: Lightbulb, target: Target, chart: ChartNoAxesCombined,
  payment: CreditCard, receipt: Receipt, package: Package, delivery: Truck,
  location: MapPin, building: Building2, cloud: Cloud, automation: Zap,
  code: Code2, key: KeyRound, support: Headphones, flag: Flag,
} satisfies Record<NodeIconKey, LucideIcon>;
