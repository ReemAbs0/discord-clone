import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import Avatar from "../Avatar";

type Member = {
  _id: string;
  userId: Id<"users">;
  name: string;
  avatarUrl: string | null;
  online: boolean;
  isOwner: boolean;
};

export default function MemberList({ serverId }: { serverId: Id<"servers"> }) {
  const members = useQuery(api.serverMembers.listForServer, { serverId });
  const me = useQuery(api.users.getMe);
  const leave = useMutation(api.serverMembers.leave);
  const navigate = useNavigate();

  const myRow = members?.find((m) => m.userId === me?.id);
  const canLeave = myRow !== undefined && !myRow.isOwner;

  async function handleLeave() {
    await leave({ serverId });
    navigate("/", { replace: true });
  }

  const online = members?.filter((m) => m.online) ?? [];
  const offline = members?.filter((m) => !m.online) ?? [];

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-surface-raised">
      <div className="flex-1 overflow-y-auto p-3">
        {members === undefined ? (
          <p className="text-sm text-content-muted">Loading members…</p>
        ) : (
          <>
            <MemberGroup label={`Online — ${online.length}`} members={online} />
            <MemberGroup label={`Offline — ${offline.length}`} members={offline} dim />
          </>
        )}
      </div>
      {canLeave && (
        <button
          onClick={() => void handleLeave()}
          className="m-3 rounded bg-surface-hover px-3 py-1.5 text-sm text-danger hover:bg-danger hover:text-white"
        >
          Leave server
        </button>
      )}
    </aside>
  );
}

function MemberGroup({ label, members, dim }: { label: string; members: Member[]; dim?: boolean }) {
  if (members.length === 0) return null;
  return (
    <div className="mb-4">
      <h3 className="mb-1 px-1 text-xs font-bold uppercase text-content-muted">{label}</h3>
      <ul className={dim ? "opacity-60" : undefined}>
        {members.map((member) => (
          <li
            key={member._id}
            className="flex items-center gap-2 rounded px-1 py-1 hover:bg-surface-hover"
          >
            <div className="relative">
              <Avatar name={member.name} avatarUrl={member.avatarUrl} size={32} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-raised ${
                  member.online ? "bg-online" : "bg-content-faint"
                }`}
              />
            </div>
            <span className="truncate text-sm text-content-primary">{member.name}</span>
            {member.isOwner && (
              <span className="ml-auto text-xs text-content-faint" title="Server owner">
                👑
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
