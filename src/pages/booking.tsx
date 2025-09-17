import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Slot = { start: string; end: string };

function useTimezoneDefault() {
  const [tz, setTz] = React.useState<string>("Asia/Tokyo");
  React.useEffect(() => {
    try {
      const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (guess) setTz(guess);
    } catch {}
  }, []);
  return [tz, setTz] as const;
}

function formatSlot(dtIso: string, tz: string) {
  try {
    const d = new Date(dtIso);
    return d.toLocaleString("ja-JP", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return dtIso;
  }
}

export default function BookingPage() {
  const todayStr = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const [date, setDate] = React.useState<string>(todayStr);
  const [duration, setDuration] = React.useState<string>("30");
  const [tz, setTz] = useTimezoneDefault();
  const [loading, setLoading] = React.useState(false);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<Slot | null>(null);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [bookingMsg, setBookingMsg] = React.useState<string | null>(null);

  async function fetchSlots() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (duration) params.set("duration", duration);
      if (tz) params.set("tz", tz);
      const resp = await fetch(`/api/slots?${params.toString()}`);
      const json = await resp.json();
      if (!resp.ok)
        throw new Error(json?.message || "スロット取得に失敗しました");
      setSlots(Array.isArray(json.slots) ? json.slots : []);
    } catch (e: unknown) {
      const msg =
        typeof e === "object" &&
        e &&
        "message" in e &&
        typeof (e as { message?: unknown }).message === "string"
          ? (e as { message: string }).message
          : "スロット取得に失敗しました";
      setError(msg);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onClickBook(slot: Slot) {
    setSelected(slot);
    setOpen(true);
    setBookingMsg(null);
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBookingMsg(null);
    try {
      const resp = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: selected.start,
          end: selected.end,
          name,
          email,
          note: note || undefined,
        }),
      });
      const json = await resp.json();
      if (!resp.ok)
        throw new Error(json?.message || `予約に失敗しました (${resp.status})`);
      setBookingMsg("予約が完了しました");
      setOpen(false);
      // 再読込して最新の空き状況を表示
      fetchSlots();
    } catch (e: unknown) {
      const msg =
        typeof e === "object" &&
        e &&
        "message" in e &&
        typeof (e as { message?: unknown }).message === "string"
          ? (e as { message: string }).message
          : "予約に失敗しました";
      setBookingMsg(msg);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">予約スロット</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="date">日付</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration">時間枠</Label>
          <select
            id="duration"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="15">15分</option>
            <option value="30">30分</option>
            <option value="45">45分</option>
            <option value="60">60分</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tz">タイムゾーン</Label>
          <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchSlots}
            disabled={loading}
            className="mt-6 w-full"
          >
            {loading ? "読み込み中…" : "更新"}
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {slots.map((s) => (
          <div
            key={`${s.start}_${s.end}`}
            className="border rounded-lg p-3 flex flex-col gap-2 bg-white/5"
          >
            <div className="text-sm">
              <div>
                <span className="text-muted-foreground">開始:</span>{" "}
                {formatSlot(s.start, tz)}
              </div>
              <div>
                <span className="text-muted-foreground">終了:</span>{" "}
                {formatSlot(s.end, tz)}
              </div>
            </div>
            <div className="flex justify-end">
              <Dialog
                open={
                  open && selected?.start === s.start && selected?.end === s.end
                }
                onOpenChange={setOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="secondary" onClick={() => onClickBook(s)}>
                    予約
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background text-foreground">
                  <DialogHeader>
                    <DialogTitle>予約情報の入力</DialogTitle>
                    <DialogDescription>
                      {formatSlot(s.start, tz)} – {formatSlot(s.end, tz)}
                    </DialogDescription>
                  </DialogHeader>
                  <form className="space-y-3" onSubmit={submitBooking}>
                    <div className="space-y-2">
                      <Label htmlFor="name">お名前</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">メール</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        maxLength={254}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="note">メモ（任意）</Label>
                      <Textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={140}
                      />
                    </div>
                    {bookingMsg && (
                      <div className="text-sm text-red-500">{bookingMsg}</div>
                    )}
                    <DialogFooter>
                      <Button type="submit">送信</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ))}
      </div>

      {!loading && slots.length === 0 && (
        <div className="text-sm text-muted-foreground">
          この条件に一致する空き枠がありません。
        </div>
      )}
    </div>
  );
}
