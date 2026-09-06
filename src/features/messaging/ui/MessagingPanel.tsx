"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { rolRozetiDolu } from "@/lib/ui/rol-renkleri";
import { useCanliAkis } from "./useCanliAkis";
import { useYaziyorGonder } from "./useYaziyorGonder";
import { tarihBicimle, saatBicimle } from "@/lib/tarih";

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  sender: {
    id: string;
    name: string | null;
    lastName: string | null;
    role: string;
  };
};

type Conversation = {
  partner: {
    id: string;
    name: string | null;
    lastName: string | null;
    role: string;
  };
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
  } | null;
  unreadCount: number;
};

type Props = {
  currentUserId: string;
};

export function MessagingPanel({ currentUserId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Conversation["partner"] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  // #354: Şu an BANA yazanların kimlikleri (sunucudan tam durum olarak gelir).
  const [yazanlar, setYazanlar] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationsError, setConversationsError] = useState(false);
  const [messagesError, setMessagesError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const getFullName = (user: { name: string | null; lastName: string | null }) =>
    [user.name, user.lastName].filter(Boolean).join(" ") || "İsimsiz";

  // #338: Renkler merkezi kaynaktan. Öncesi burada MENTOR=mor, STUDENT=mavi
  // idi; admin panelinde ise mavi MENTOR'u temsil ediyordu — aynı kişi iki
  // ekranda iki farklı renkte görünüyordu.
  const getRoleBadge = (role: string) => {
    const r = rolRozetiDolu(role);
    return { label: r.etiket, color: r.sinif };
  };

  // Konuşma listesini yükle
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
        setConversationsError(false);
      } else {
        setConversationsError(true);
      }
    } catch (error) {
      console.error("Konuşmalar yüklenemedi:", error);
      setConversationsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mesajları yükle
  const loadMessages = useCallback(async (partnerId: string, isPolling = false) => {
    if (!isPolling) {
      setLoadingMessages(true);
      setMessagesError(false);
    }
    try {
      const res = await fetch(`/api/messages?conversationWith=${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages.reverse()); // Eski → Yeni sırala
      } else if (!isPolling) {
        // Polling hatalarını sessiz geç — mevcut mesajları ekranda tut.
        setMessagesError(true);
      }
    } catch (error) {
      console.error("Mesajlar yüklenemedi:", error);
      if (!isPolling) setMessagesError(true);
    } finally {
      if (!isPolling) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // #329: Canlı akış. Açık konuşmadan gelen mesajda listeyi, diğer
  // konuşmalardan gelende konuşma listesini tazeliyoruz.
  //
  // Olayın İÇERİĞİNİ doğrudan listeye eklemiyoruz, yeniden yüklüyoruz:
  // mesajın gönderen bilgisi, okundu durumu ve sıralaması sunucudan geliyor;
  // olaydan kısmi bir nesne kurmak iki kaynağı ayrıştırırdı.
  const seciliRef = useRef<string | null>(null);
  seciliRef.current = selectedPartner?.id ?? null;

  const { bagli } = useCanliAkis(
    useCallback(
      (olay) => {
        // #354: Gösterge tam durumla değişiyor — "bıraktı" olayı yok, küme boşalır.
        if (olay.tip === "yaziyor") {
          setYazanlar(olay.kimler);
          return;
        }
        if (olay.tip !== "mesaj") return;
        if (olay.gonderenId === seciliRef.current) {
          loadMessages(olay.gonderenId, true);
        }
        loadConversations();
      },
      [loadMessages, loadConversations],
    ),
  );

  // #354: Yazma sinyalini gönderen taraf.
  const { yazdiginiBildir, durdur: yazmayiDurdur } = useYaziyorGonder(
    selectedPartner?.id ?? null,
  );

  // Seçili konuşma değiştiğinde mesajları yükle
  useEffect(() => {
    if (!selectedPartner) return;
    loadMessages(selectedPartner.id);
  }, [selectedPartner, loadMessages]);

  // #329: YOKLAMA YEDEĞİ — yalnızca akış KOPUKKEN. Tamamen kaldırılsaydı,
  // SSE'yi kesen bir vekilin arkasında mesajlaşma ölü kalırdı.
  useEffect(() => {
    if (!selectedPartner || bagli) return;

    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadMessages(selectedPartner.id, true);
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedPartner, loadMessages, bagli]);

  // Yeni mesaj geldiğinde scroll aşağı
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedPartner || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedPartner.id,
          content: newMessage.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");
        // Mesaj gitti; süre dolmasını beklemeden göstergeden düş — aksi halde
        // karşı taraf mesajı okurken hâlâ "yazıyor" görürdü.
        yazmayiDurdur();
        // Konuşma listesini güncelle
        loadConversations();
      } else {
        const err = await res.json();
        toast.error(err.error || "Mesaj gönderilemedi.");
      }
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return saatBicimle(d);
    }
    return tarihBicimle(d, { day: "numeric", month: "short" }) + " " + saatBicimle(d);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Konuşmalar yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex h-[600px]">
      {/* Konuşma Listesi */}
      <div className={`w-full md:w-80 border-r flex flex-col ${selectedPartner ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <MessageCircle className="w-5 h-5 mr-2" />
            Mesajlar
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversationsError ? (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600">Konuşmalar yüklenemedi.</p>
              <button
                onClick={() => {
                  setLoading(true);
                  loadConversations();
                }}
                className="mt-3 px-4 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Tekrar Dene
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Henüz konuşma bulunmuyor.</p>
              <p className="text-xs text-gray-400 mt-1">Mentor-öğrenci eşleşmesi yapıldığında mesajlaşabilirsiniz.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const badge = getRoleBadge(conv.partner.role);
              return (
                <button
                  key={conv.partner.id}
                  onClick={() => setSelectedPartner(conv.partner)}
                  className={`w-full text-left p-4 border-b transition-colors hover:bg-gray-50 ${
                    selectedPartner?.id === conv.partner.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 text-sm">
                      {getFullName(conv.partner)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${badge.color}`}>
                        {badge.label}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {conv.lastMessage && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 truncate max-w-[180px]">
                        {conv.lastMessage.senderId === currentUserId ? "Sen: " : ""}
                        {conv.lastMessage.content}
                      </p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                        {formatTime(conv.lastMessage.createdAt)}
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Mesaj Alanı */}
      <div className={`flex-1 flex flex-col ${!selectedPartner ? "hidden md:flex" : "flex"}`}>
        {!selectedPartner ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Bir konuşma seçin</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b bg-gray-50 flex items-center gap-3">
              <button
                onClick={() => setSelectedPartner(null)}
                className="md:hidden p-1 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {getFullName(selectedPartner)}
                </p>
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${getRoleBadge(selectedPartner.role).color}`}>
                  {getRoleBadge(selectedPartner.role).label}
                </span>
              </div>
            </div>

            {/* Mesajlar */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                </div>
              ) : messagesError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Mesajlar yüklenemedi.</p>
                    <button
                      onClick={() => loadMessages(selectedPartner.id)}
                      className="mt-3 px-4 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Tekrar Dene
                    </button>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="text-sm">Henüz mesaj yok. İlk mesajı gönderin!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.senderId === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isOwn
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-white border text-gray-900 rounded-bl-md shadow-sm"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isOwn ? "text-blue-200" : "text-gray-400 "}`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              {/* #354: Yalnızca AÇIK konuşmanın karşı tarafı yazıyorsa. Sunucu
                  bize yazan herkesi yolluyor; başka bir konuşmadaki yazma
                  bu balonu göstermemeli. */}
              {selectedPartner && yazanlar.includes(selectedPartner.id) && (
                <div className="flex justify-start">
                  <div
                    className="bg-white border rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="sr-only">{getFullName(selectedPartner)} yazıyor</span>
                    <span className="flex items-center gap-1" aria-hidden="true">
                      {[0, 150, 300].map((gecikme) => (
                        <span
                          key={gecikme}
                          className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: `${gecikme}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Mesaj Gönder */}
            <form onSubmit={handleSend} className="p-3 border-t bg-white flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  // Metin SİLİNİP boşaldıysa yazma bitti sayılır.
                  if (e.target.value.trim()) yazdiginiBildir();
                  else yazmayiDurdur();
                }}
                placeholder="Mesajınızı yazın..."
                maxLength={2000}
                className="flex-1 px-4 py-2.5 bg-gray-100 border-0 rounded-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="w-10 h-10 flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
