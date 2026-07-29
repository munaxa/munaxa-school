import { AttendanceStatusBadge, StudentAvatar } from "../../components";
import { Button } from "@/components/ui/button";
const roster = [{name:"Lina Haddad",status:"present"},{name:"Omar Saleh",status:"late"},{name:"Maya Khalil",status:"absent"}] as const;
export function AttendanceExample() { return <section aria-labelledby="register-title" className="space-y-4"><header className="flex items-end justify-between"><div><h2 id="register-title" className="text-2xl font-semibold">Grade 8A register</h2><p className="text-sm text-muted-foreground">Thursday, 18 June · Morning</p></div><Button>Submit register</Button></header><ul className="divide-y rounded-xl border">{roster.map((student)=><li key={student.name} className="flex items-center gap-3 p-4"><StudentAvatar name={student.name}/><span className="flex-1 font-medium">{student.name}</span><AttendanceStatusBadge status={student.status}/></li>)}</ul></section>; }
export default AttendanceExample;
