import { useState, type FormEvent, type KeyboardEvent } from "react";

// Presentational: the parent owns the send mutation (and its optimistic
// update). `onType` is optional — channels wire it to the typing heartbeat,
// DMs leave it unset (typing indicators are channel-only per FR-021).
export default function MessageComposer({
  placeholder,
  onSend,
  onType,
}: {
  placeholder: string;
  onSend: (content: string) => Promise<unknown> | void;
  onType?: () => void;
}) {
  const [content, setContent] = useState("");

  function handleChange(value: string) {
    setContent(value);
    if (value.length > 0) onType?.();
  }

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent("");
    await onSend(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void handleSend();
      }}
      className="p-4"
    >
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="w-full resize-none rounded-lg bg-surface-raised px-4 py-2.5 text-content-primary outline-none placeholder:text-content-faint"
      />
    </form>
  );
}
