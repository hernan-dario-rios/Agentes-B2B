"use client";

import React, { useState, useEffect } from "react";
import {
  Inbox,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Send,
  Building2,
  Mail,
  ShieldCheck,
  Server,
  Layers,
  Sparkles,
  RefreshCw,
  Plus,
  FileText,
  DollarSign,
  Clock,
  ArrowRight,
  Database,
  Cloud,
  Copy,
  Check,
  ExternalLink,
  Pencil,
  Save,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Users,
  Target,
  FileCode,
  Eye,
  Info,
  Phone,
  MessageSquare,
  Compass,
  Radio,
  Zap,
  MapPin,
  PhoneCall,
  PhoneOff,
  User,
  Bot,
  Volume2,
  VolumeX,
  Hand,
  Mic,
  MicOff,
  Headphones,
  PhoneForwarded,
  Play,
  Square,
  Pause,
  Lock,
  Key,
  LogOut,
  QrCode,
  EyeOff,
  Smartphone,
  RotateCcw
} from "lucide-react";

// Endpoint de API con Reverse Proxy nativo de Next.js (Mismo origen / sin bloqueos de puerto 8000 ni CORS)
const API_BASE = "/api/v1";

export default function SalesCommandCenter() {
  // === Estados de Autenticación & 2FA ===
  const [authToken, setAuthToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Estados de Formulario de Login & 2FA
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("AdminPassword2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [authStep, setAuthStep] = useState("credentials"); // "credentials" | "2fa_setup" | "2fa_verify"
  const [authTempToken, setAuthTempToken] = useState("");
  const [authQrCodeUrl, setAuthQrCodeUrl] = useState("");
  const [authTotpSecret, setAuthTotpSecret] = useState("");
  const [authTotpCode, setAuthTotpCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // Helper para peticiones autenticadas con auto-logout en 401
  const authFetch = async (url, options = {}) => {
    const token = authToken || (typeof window !== "undefined" ? localStorage.getItem("innovait_auth_token") : null);
    const headers = { ...(options.headers || {}) };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
    }
    return res;
  };

  // Verificación de sesión al iniciar
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("innovait_auth_token") : null;
    if (!token) {
      setAuthChecking(false);
      return;
    }
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Sesión inválida o expirada");
      })
      .then((userData) => {
        setAuthToken(token);
        setCurrentUser(userData);
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("innovait_auth_token");
        }
        setAuthToken(null);
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("innovait_auth_token");
    }
    setAuthToken(null);
    setCurrentUser(null);
    setAuthStep("credentials");
    setAuthTotpCode("");
    setAuthError("");
  };

  const handleLoginSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al autenticar credenciales");
      }
      if (data.status === "requires_2fa") {
        setAuthTempToken(data.temp_token);
        setAuthTotpCode("");
        setAuthStep("2fa_verify");
      } else if (data.status === "requires_2fa_setup") {
        setAuthTempToken(data.temp_token);
        setAuthQrCodeUrl(data.qr_code_url || "");
        setAuthTotpSecret(data.two_factor_secret || "");
        setAuthTotpCode("");
        setAuthStep("2fa_setup");
      } else if (data.status === "authenticated" && data.access_token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("innovait_auth_token", data.access_token);
        }
        setAuthToken(data.access_token);
        setCurrentUser(data.user);
      }
    } catch (err) {
      setAuthError(err.message || "Error al conectar con el servidor de autenticación");
    } finally {
      setAuthLoading(false);
    }
  };

  const handle2FAVerifySubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setAuthError("");
    if (!authTotpCode || authTotpCode.length < 6) {
      setAuthError("Ingrese los 6 dígitos del código de autenticación");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_token: authTempToken, code: authTotpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Código de seguridad 2FA inválido");
      }
      if (data.status === "authenticated" && data.access_token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("innovait_auth_token", data.access_token);
        }
        setAuthToken(data.access_token);
        setCurrentUser(data.user);
        setAuthStep("credentials");
      }
    } catch (err) {
      setAuthError(err.message || "Error al verificar código 2FA");
    } finally {
      setAuthLoading(false);
    }
  };

  const handle2FASetupSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setAuthError("");
    if (!authTotpCode || authTotpCode.length < 6) {
      setAuthError("Ingrese los 6 dígitos generados en su aplicación autenticadora");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/setup-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_token: authTempToken, code: authTotpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Código incorrecto al confirmar vinculación");
      }
      if (data.status === "authenticated" && data.access_token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("innovait_auth_token", data.access_token);
        }
        setAuthToken(data.access_token);
        setCurrentUser(data.user);
        setAuthStep("credentials");
      }
    } catch (err) {
      setAuthError(err.message || "Error al confirmar enrolamiento 2FA");
    } finally {
      setAuthLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState("inbox"); // "inbox" | "kanban" | "catalog"
  const [pendingGates, setPendingGates] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedGateDetails, setExpandedGateDetails] = useState({});
  const [masterCatalogModalOpen, setMasterCatalogModalOpen] = useState(false);
  const [catalogJsonCopied, setCatalogJsonCopied] = useState(false);
  const [activeCatalogModalTab, setActiveCatalogModalTab] = useState("structured"); // "structured" | "json"
  const [collapsedCards, setCollapsedCards] = useState({});

  const toggleCardCollapse = (oppId) => {
    setCollapsedCards((prev) => ({
      ...prev,
      [oppId]: !prev[oppId],
    }));
  };

  const handleCollapseAll = () => {
    const all = {};
    pendingGates.forEach((g) => {
      all[g.opportunity_id] = true;
    });
    setCollapsedCards(all);
  };

  const handleExpandAll = () => {
    setCollapsedCards({});
  };

  // Control de pestañas multicanal para Gate 2 (Outreach)
  const [activeOutreachTabs, setActiveOutreachTabs] = useState({});
  const [outreachChannel, setOutreachChannel] = useState("whatsapp");

  const getOutreachTab = (gate) => {
    if (activeOutreachTabs[gate.opportunity_id]) {
      return activeOutreachTabs[gate.opportunity_id];
    }
    // Si es PyME sin web o tiene mensaje de WhatsApp generado, sugerir WhatsApp por defecto
    if (gate.context_details?.whatsapp_message || gate.context_details?.is_sme) {
      return "whatsapp";
    }
    return "email";
  };

  const handleCopyText = (text, oppId) => {
    if (navigator?.clipboard && text) {
      navigator.clipboard.writeText(text);
      setCopiedId(oppId);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleCopyOutreach = (gate) => {
    const currentTab = getOutreachTab(gate);
    if (currentTab === "whatsapp") {
      const waText = gate.context_details?.whatsapp_message || gate.recommendation_summary || "";
      handleCopyText(waText, gate.opportunity_id);
      return;
    }
    if (currentTab === "call") {
      const callText = gate.context_details?.call_script || gate.recommendation_summary || "";
      handleCopyText(callText, gate.opportunity_id);
      return;
    }
    const subject = gate.context_details?.subject || gate.key_metrics?.subject || "INNOVAIT | Transformación digital y eficiencia operativa";
    const body = gate.context_details?.body_markdown || gate.recommendation_summary || "";
    const textToCopy = `Asunto: ${subject}\n\n${body}`;
    handleCopyText(textToCopy, gate.opportunity_id);
  };

  // Modal de Decisión Humana (Modify / Feedback)
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [modifyTarget, setModifyTarget] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [discountValue, setDiscountValue] = useState("");

  // Modal de Devolución / Retroceso de Gate
  const [regressModalOpen, setRegressModalOpen] = useState(false);
  const [regressTarget, setRegressTarget] = useState(null);
  const [regressTargetGate, setRegressTargetGate] = useState("");
  const [regressReason, setRegressReason] = useState("");
  const [regressingGate, setRegressingGate] = useState(false);

  const getAvailablePreviousGates = (currentGate) => {
    const allGates = [
      { id: "GATE_1_TARGET", label: "Gate 1: Validación de Target / ICP (Enricher)" },
      { id: "GATE_2_OUTREACH", label: "Gate 2: Outreach Multicanal & Llamada con Sara" },
      { id: "GATE_3_DISCOVERY", label: "Gate 3: Validación Alcance BANT (Discovery)" },
      { id: "GATE_4_ARCHITECT", label: "Gate 4: Arquitectura de Soluciones & Pricing" },
      { id: "GATE_5_LEGAL", label: "Gate 5: Firma & Términos Legales (SOW / MSA)" }
    ];
    const order = ["GATE_1_TARGET", "GATE_2_OUTREACH", "GATE_3_DISCOVERY", "GATE_4_ARCHITECT", "GATE_5_LEGAL"];
    const currentIndex = order.indexOf(currentGate);
    if (currentIndex <= 0) return [];
    return allGates.filter((g, idx) => idx < currentIndex).reverse();
  };

  const handleOpenRegressModal = (gate) => {
    setRegressTarget(gate);
    const prevGates = getAvailablePreviousGates(gate.gate_type);
    setRegressTargetGate(prevGates[0]?.id || "GATE_1_TARGET");
    setRegressReason("");
    setRegressModalOpen(true);
  };

  const handleRegressGateSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!regressTarget || !regressTargetGate) return;
    setRegressingGate(true);
    try {
      const res = await authFetch(`${API_BASE}/gates/${regressTarget.opportunity_id}/regress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_gate: regressTargetGate,
          reason: regressReason || "Devolución solicitada por Director Comercial para recalificar o repetir etapa.",
          user_name: currentUser?.name || "Director Comercial (Comando Central)"
        })
      });
      if (res.ok) {
        await fetchData();
        setRegressModalOpen(false);
        setRegressTarget(null);
        setRegressReason("");
        alert(`⏪ ¡Prospecto devuelto exitosamente a ${regressTargetGate}!\n\nSe ha colocado en espera de aprobación humana en su nueva compuerta.`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error al devolver prospecto: ${err.detail || "Error en el servidor"}`);
      }
    } catch (err) {
      alert(`Error de comunicación: ${err.message}`);
    } finally {
      setRegressingGate(false);
    }
  };

  // Modal de Confirmación de Envío en Gate 2 (Outreach desde Outlook o WhatsApp)
  const [confirmOutreachModalOpen, setConfirmOutreachModalOpen] = useState(false);
  const [outreachConfirmTarget, setOutreachConfirmTarget] = useState(null);
  const [finalSubject, setFinalSubject] = useState("");
  const [finalBody, setFinalBody] = useState("");
  const [finalRecipient, setFinalRecipient] = useState("");

  const handleOpenConfirmOutreach = (gate) => {
    setOutreachConfirmTarget(gate);
    const isSme = gate.context_details?.is_sme;
    const initialChannel = isSme ? "whatsapp" : "email";
    setOutreachChannel(initialChannel);
    if (initialChannel === "whatsapp") {
      setFinalSubject(`WhatsApp Comercial - ${gate.company_name}`);
      setFinalBody(gate.context_details?.whatsapp_message || gate.recommendation_summary || "");
      const phone = gate.context_details?.contacts?.[0]?.phone || "";
      setFinalRecipient(phone || "Móvil / WhatsApp");
    } else {
      const subject = gate.context_details?.subject || gate.key_metrics?.subject || gate.headline || "Propuesta de Transformación INNOVAIT";
      const body = gate.context_details?.body_markdown || gate.recommendation_summary || "";
      const contact = gate.context_details?.contacts?.[0]?.email || gate.key_metrics?.contact || "";
      setFinalSubject(subject);
      setFinalBody(body);
      setFinalRecipient(contact);
    }
    setConfirmOutreachModalOpen(true);
  };

  const handleChannelSwitchInModal = (ch) => {
    setOutreachChannel(ch);
    if (!outreachConfirmTarget) return;
    if (ch === "whatsapp") {
      setFinalSubject(`WhatsApp Comercial - ${outreachConfirmTarget.company_name}`);
      setFinalBody(outreachConfirmTarget.context_details?.whatsapp_message || outreachConfirmTarget.recommendation_summary || "");
      const phone = outreachConfirmTarget.context_details?.contacts?.[0]?.phone || "";
      setFinalRecipient(phone || "Móvil / WhatsApp");
    } else if (ch === "phone") {
      setFinalSubject(`Llamada Telefónica - ${outreachConfirmTarget.company_name}`);
      setFinalBody(`Llamada telefónica con ${outreachConfirmTarget.context_details?.contacts?.[0]?.name || "contacto principal"}. Se validó interés en optimización de archivo físico.`);
      const phone = outreachConfirmTarget.context_details?.contacts?.[0]?.phone || "";
      setFinalRecipient(phone || "PBX / Teléfono");
    } else {
      setFinalSubject(outreachConfirmTarget.context_details?.subject || outreachConfirmTarget.key_metrics?.subject || "INNOVAIT | Transformación digital y eficiencia");
      setFinalBody(outreachConfirmTarget.context_details?.body_markdown || outreachConfirmTarget.recommendation_summary || "");
      const email = outreachConfirmTarget.context_details?.contacts?.[0]?.email || outreachConfirmTarget.key_metrics?.contact || "";
      setFinalRecipient(email || "correo@empresa.com");
    }
  };

  // Modal y Gestión de Agente de Voz Sara (Llamadas Celular SIM Android + Gemini Live)
  const [saraModalOpen, setSaraModalOpen] = useState(false);
  const [saraTargetGate, setSaraTargetGate] = useState(null);
  const [saraPhone, setSaraPhone] = useState("");
  const [saraVoice, setSaraVoice] = useState("paloma");
  const [saraContactName, setSaraContactName] = useState("");
  const [saraContactRole, setSaraContactRole] = useState("");
  const [saraCustomInstructions, setSaraCustomInstructions] = useState("");
  const [saraPrompt, setSaraPrompt] = useState("");
  const [saraLoadingPrompt, setSaraLoadingPrompt] = useState(false);
  const [saraSimulating, setSaraSimulating] = useState(false);
  const [saraDispatching, setSaraDispatching] = useState(false);
  const [saraSavingGate3, setSaraSavingGate3] = useState(false);
  const [saraSimulationResult, setSaraSimulationResult] = useState(null);
  const [saraDispatchedJob, setSaraDispatchedJob] = useState(null);
  const [saraActiveSubTab, setSaraActiveSubTab] = useState("preview"); // "preview" | "simulate" | "dispatch" | "guide"

  // Parser tolerante de transcripción (acepta string multilínea, array de strings o array de objetos)
  const parseTranscriptItems = (rawTranscript) => {
    if (!rawTranscript) return [];
    if (Array.isArray(rawTranscript)) {
      return rawTranscript.map((item, idx) => {
        if (typeof item === "string") {
          const colonIdx = item.indexOf(":");
          if (colonIdx > -1) {
            return {
              speaker: item.substring(0, colonIdx).trim().replace(/^\*+|\*+$/g, ""),
              text: item.substring(colonIdx + 1).trim()
            };
          }
          return { speaker: idx % 2 === 0 ? "Sara" : "Contacto", text: item.trim() };
        }
        return item;
      });
    }
    if (typeof rawTranscript === "string") {
      return rawTranscript
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line, idx) => {
          const colonIdx = line.indexOf(":");
          if (colonIdx > -1) {
            return {
              speaker: line.substring(0, colonIdx).trim().replace(/^\*+|\*+$/g, ""),
              text: line.substring(colonIdx + 1).trim()
            };
          }
          return { speaker: idx % 2 === 0 ? "Sara" : "Contacto", text: line };
        });
    }
    return [];
  };

  // Reproductor de Audio Neuronal de Alta Fidelidad
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(-1);
  const currentAudioElementRef = React.useRef(null);

  // Saludo temporal colombiano según la hora en Colombia (America/Bogota, UTC-5)
  const getColombianGreeting = () => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Bogota",
        hour: "numeric",
        hour12: false
      });
      const hour = parseInt(formatter.format(now), 10);
      if (hour >= 5 && hour < 12) return "muy buenos días";
      if (hour >= 12 && hour < 18) return "muy buenas tardes";
      return "muy buenas noches";
    } catch {
      const h = new Date().getHours();
      if (h >= 5 && h < 12) return "muy buenos días";
      if (h >= 12 && h < 18) return "muy buenas tardes";
      return "muy buenas noches";
    }
  };

  // Valida con rigor si un contacto es genérico, desconocido, solo puntuación o un cargo sin nombre propio
  const isGenericContact = (name) => {
    if (!name || typeof name !== "string") return true;
    const withoutParens = name.replace(/\(.*?\)/g, "").trim();
    const lower = withoutParens.toLowerCase();
    if (!lower || ["desconocido", "por definir", "sin contacto", "n/a", "none", "null", "contacto", "principal", "interlocutor"].includes(lower)) return true;
    if (lower.includes("/") || lower.includes("\\") || lower.includes("barra")) return true;

    const genericTokens = new Set([
      "director", "directora", "gerente", "lider", "líder", "jefe", "jefatura", "responsable",
      "encargado", "encargada", "tecnologia", "tecnología", "operaciones", "sistemas",
      "ti", "it", "de", "del", "la", "el", "y", "o", "en", "para", "area", "área",
      "infraestructura", "desconocido", "contacto", "cargo", "puesto", "soporte",
      "ingenieria", "ingeniería", "coordinador", "coordinadora", "asesor", "consultor",
      "analista", "auxiliar", "administrador", "administradora", "seguridad", "desarrollo", "principal"
    ]);

    const words = lower.match(/[a-záéíóúñ]+/gi) || [];
    if (words.length === 0) return true;
    if (words.every(w => genericTokens.has(w))) return true;
    return false;
  };

  // Extrae el nombre propio limpio de un contacto si es válido; si es genérico o vacío retorna ""
  const extractCleanName = (raw) => {
    if (!raw || typeof raw !== "string") return "";
    const cleaned = raw.replace(/\(.*?\)/g, "").trim();
    return isGenericContact(cleaned) ? "" : cleaned;
  };

  // Selector de voz de respaldo: NUNCA usar acento de España (es-ES).
  // Prioriza voz colombiana (es-CO) o latinoamericana seseante (es-419, es-US, es-MX).
  const selectBestColombianOrLatinVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    // 1. Prioridad: Voz colombiana explícita
    const colVoice = voices.find((v) =>
      v.lang === "es-CO" ||
      v.lang.toLowerCase().startsWith("es-co") ||
      (v.lang.toLowerCase().startsWith("es") && v.name.toLowerCase().includes("colombia"))
    );
    if (colVoice) return colVoice;

    // 2. Prioridad: Voces latinoamericanas (es-419, es-US, es-MX) descartando explícitamente España (es-ES)
    const latins = voices.filter((v) => {
      const l = (v.lang || "").toLowerCase();
      const n = (v.name || "").toLowerCase();
      const isSpain = l.includes("es-es") || n.includes("spain") || n.includes("españa") || n.includes("helena") || n.includes("laura");
      return !isSpain && (
        l.includes("es-419") || l.includes("es-us") || l.includes("es-mx") || l.includes("es-cl") || l.includes("es-ar") ||
        n.includes("sabina") || n.includes("mexic") || n.includes("latino") || n.includes("latin") || n.includes("paulina") || n.includes("raul")
      );
    });
    if (latins.length > 0) {
      const femaleLatin = latins.find((v) =>
        v.name.toLowerCase().includes("sabina") ||
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("femenin") ||
        v.name.toLowerCase().includes("paulina")
      );
      return femaleLatin || latins[0];
    }

    // 3. Cualquier voz en español descartando España
    const nonSpain = voices.find((v) =>
      v.lang.toLowerCase().startsWith("es") &&
      !v.lang.toLowerCase().includes("es-es") &&
      !v.name.toLowerCase().includes("spain") &&
      !v.name.toLowerCase().includes("españa")
    );
    if (nonSpain) return nonSpain;

    return voices.find((v) => v.lang.toLowerCase().startsWith("es")) || null;
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const stopAudioPlayback = () => {
    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current.currentTime = 0;
      } catch {}
      currentAudioElementRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsPlayingAudio(false);
    setCurrentAudioIndex(-1);
  };

  const playTranscriptAudio = (transcriptItems) => {
    if (isPlayingAudio) {
      stopAudioPlayback();
      return;
    }

    if (!transcriptItems || transcriptItems.length === 0) return;

    stopAudioPlayback();
    setIsPlayingAudio(true);
    setCurrentAudioIndex(0);

    let currentIndex = 0;

    const playNextTurn = () => {
      if (currentIndex >= transcriptItems.length) {
        setIsPlayingAudio(false);
        setCurrentAudioIndex(-1);
        return;
      }

      setCurrentAudioIndex(currentIndex);
      const item = transcriptItems[currentIndex];
      const speaker = item.speaker || (currentIndex % 2 === 0 ? "Sara" : "Contacto");

      // Usar servicio TTS neuronal de alta fidelidad con la voz seleccionada (colombiana o latina)
      const isSaraSpeaker = (speaker || "").toLowerCase().includes("sara") || (speaker || "").toLowerCase().includes("maggie");
      const voiceForSpeaker = isSaraSpeaker ? (saraVoice || "paloma") : "jorge";
      const ttsUrl = `${API_BASE}/voice/tts?text=${encodeURIComponent(item.text)}&speaker=${encodeURIComponent(speaker)}&voice_id=${encodeURIComponent(voiceForSpeaker)}`;
      const audio = new Audio(ttsUrl);
      currentAudioElementRef.current = audio;

      audio.onended = () => {
        currentIndex++;
        setTimeout(() => {
          playNextTurn();
        }, 350);
      };

      audio.onerror = (err) => {
        console.warn("Fallo endpoint TTS neuronal, usando fallback Web Speech latino:", err);
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const phoneticText = item.text
            .replace(/\bSimon\b/gi, "Simón");
          const utter = new SpeechSynthesisUtterance(phoneticText);
          const bestVoice = selectBestColombianOrLatinVoice();
          if (bestVoice) {
            utter.voice = bestVoice;
            utter.lang = bestVoice.lang;
          } else {
            utter.lang = "es-CO";
          }
          utter.pitch = isSaraSpeaker ? 1.15 : 0.95;
          utter.rate = 1.02;
          utter.onend = () => {
            currentIndex++;
            setTimeout(() => playNextTurn(), 350);
          };
          window.speechSynthesis.speak(utter);
        } else {
          currentIndex++;
          playNextTurn();
        }
      };

      audio.play().catch((playErr) => {
        console.warn("Audio play prevented:", playErr);
        currentIndex++;
        playNextTurn();
      });
    };

    playNextTurn();
  };

  // Modo Llamada Interactiva en Vivo (Micrófono: Usuario vs Sara)
  const [liveCallActive, setLiveCallActive] = useState(false);
  const [liveCallStatus, setLiveCallStatus] = useState("idle"); // "idle" | "listening" | "thinking" | "speaking" | "ended"
  const [liveCallHistory, setLiveCallHistory] = useState([]);
  const [liveCallInterlocutorLabel, setLiveCallInterlocutorLabel] = useState(null);
  const [liveCallUserText, setLiveCallUserText] = useState("");
  const [liveCallSeconds, setLiveCallSeconds] = useState(0);
  const [liveCallMeetingScheduled, setLiveCallMeetingScheduled] = useState(false);
  const [liveInterimSpeech, setLiveInterimSpeech] = useState("");
  const [micPermissionError, setMicPermissionError] = useState(null);
  const [audioVolumeLevel, setAudioVolumeLevel] = useState(0);

  const recognitionRef = React.useRef(null);
  const liveAudioElementRef = React.useRef(null);
  const liveTimerRef = React.useRef(null);
  const silenceTimerRef = React.useRef(null);
  const audioStreamRef = React.useRef(null);
  const audioContextRef = React.useRef(null);

  const stopLiveCallAudio = () => {
    if (liveAudioElementRef.current) {
      try {
        liveAudioElementRef.current.pause();
        liveAudioElementRef.current.currentTime = 0;
      } catch {}
      liveAudioElementRef.current = null;
    }
  };

  const endLiveCall = () => {
    stopLiveCallAudio();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setLiveCallActive(false);
    setLiveCallStatus("ended");
    setLiveInterimSpeech("");
    setAudioVolumeLevel(0);
  };

  const playVoicePreview = (voiceId) => {
    stopLiveCallAudio();
    stopAudioPlayback();
    const greeting = getColombianGreeting();
    const sampleText = `Aló, ${greeting}. Le habla Sara de INNOVAIT Transformación Digital. ¿En qué le podemos colaborar?`;
    const ttsUrl = `${API_BASE}/voice/tts?text=${encodeURIComponent(sampleText)}&speaker=Sara&voice_id=${encodeURIComponent(voiceId || "paloma")}`;
    const audio = new Audio(ttsUrl);
    currentAudioElementRef.current = audio;
    audio.play().catch((err) => console.warn("Voice preview error:", err));
  };

  const handleInterruptSara = () => {
    stopLiveCallAudio();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setLiveCallStatus("listening");
    startMicrophoneRecognition();
  };

  const playSaraAudioReply = (text, onFinished) => {
    stopLiveCallAudio();
    setLiveCallStatus("speaking");
    const ttsUrl = `${API_BASE}/voice/tts?text=${encodeURIComponent(text)}&speaker=Sara&voice_id=${encodeURIComponent(saraVoice || "paloma")}`;
    const audio = new Audio(ttsUrl);
    liveAudioElementRef.current = audio;

    const handleSpeechEnded = () => {
      setLiveCallStatus("listening");
      startMicrophoneRecognition();
      if (onFinished) onFinished();
    };

    audio.onended = handleSpeechEnded;

    audio.onerror = (audioErr) => {
      console.warn("Fallo endpoint TTS neuronal para respuesta en vivo, usando fallback latino seseante:", audioErr);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const phoneticText = text
          .replace(/\bSimon\b/gi, "Simón");
        const utter = new SpeechSynthesisUtterance(phoneticText);
        const bestVoice = selectBestColombianOrLatinVoice();
        if (bestVoice) {
          utter.voice = bestVoice;
          utter.lang = bestVoice.lang;
        } else {
          utter.lang = "es-CO";
        }
        utter.pitch = 1.15;
        utter.rate = 1.02;
        utter.onend = handleSpeechEnded;
        utter.onerror = handleSpeechEnded;
        window.speechSynthesis.speak(utter);
      } else {
        handleSpeechEnded();
      }
    };

    audio.play().catch(() => {
      handleSpeechEnded();
    });

    // BARGE-IN: Mantener el micrófono activo mientras Sara habla para que el usuario pueda interrumpirla al hablar
    startMicrophoneRecognition();
  };

  const liveTranscriptEndRef = React.useRef(null);
  useEffect(() => {
    if (liveTranscriptEndRef.current) {
      liveTranscriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveCallHistory, liveCallStatus, liveInterimSpeech]);

  const startMicrophoneRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicPermissionError("Tu navegador no soporta reconocimiento de voz nativo (SpeechRecognition). Puedes usar Google Chrome, Microsoft Edge o interactuar con el campo de texto.");
      setLiveCallStatus("idle");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      const recognition = new SpeechRec();
      recognition.lang = "es-CO";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let localAccumulated = "";

      recognition.onstart = () => {
        // Solo cambia a listening si Sara no está hablando
        if (!liveAudioElementRef.current || liveAudioElementRef.current.paused) {
          setLiveCallStatus("listening");
        }
        setLiveInterimSpeech("");
        setMicPermissionError(null);
      };

      recognition.onresult = (event) => {
        let interim = "";
        let finalStr = localAccumulated;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += " " + chunk;
          } else {
            interim += chunk;
          }
        }
        localAccumulated = finalStr.trim();
        const currentFull = (localAccumulated + (interim ? " " + interim : "")).trim();
        if (currentFull) {
          setLiveInterimSpeech(currentFull);
        }

        // BARGE-IN / INTERRUPCIÓN EN VIVO:
        // Si el usuario empieza a hablar (>2 caracteres) mientras Sara reproduce audio,
        // silenciar a Sara inmediatamente para cederle la palabra al usuario
        if (currentFull.length >= 2 && liveAudioElementRef.current && !liveAudioElementRef.current.paused) {
          try {
            liveAudioElementRef.current.pause();
            liveAudioElementRef.current.currentTime = 0;
            liveAudioElementRef.current = null;
          } catch {}
          if (typeof window !== "undefined" && window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch {}
          }
          setLiveCallStatus("listening");
        }

        // Si el usuario dijo una frase sustancial (>2 caracteres):
        // Temporizador de silencio generoso y adaptativo para que el usuario pueda formular ideas con calma sin que le corte de una
        if (currentFull.length > 2) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Cálculo adaptativo del tiempo de pausa:
          const words = currentFull.trim().split(/\s+/);
          const lastWord = words[words.length - 1].toLowerCase().replace(/[.,!?;:]/g, "");
          const connectorWords = [
            "y", "o", "u", "e", "pero", "que", "de", "con", "en", "para", "por", "si",
            "entonces", "este", "eh", "o sea", "porque", "pues", "bueno", "como", "a ver",
            "mire", "nosotros", "yo", "también", "tambien", "además", "ademas", "sin embargo"
          ];
          const isThinkingOrMidSentence = connectorWords.includes(lastWord) || words.length <= 3;
          // Si el usuario está pensando o la frase es corta, dar 3400ms; si es oración completa, 2800ms
          const silenceDelay = isThinkingOrMidSentence ? 3400 : 2800;

          silenceTimerRef.current = setTimeout(() => {
            const trimmed = currentFull.trim();
            // Ignorar ruidos o monosílabos accidentales de menos de 3 caracteres
            if (trimmed.length >= 3) {
              try { recognition.abort(); } catch {}
              sendUserLiveMessage(trimmed);
            }
          }, silenceDelay);
        }
      };

      recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err.error);
        if (err.error === "no-speech") {
          return;
        }
        if (err.error === "not-allowed" || err.error === "service-not-allowed") {
          const isInsecure = typeof window !== "undefined" && !window.isSecureContext;
          if (isInsecure) {
            setMicPermissionError("Google Chrome y Edge bloquean el micrófono en conexiones HTTP remotas sin SSL. Para habilitarlo en pruebas, abre chrome://flags/#unsafely-treat-insecure-origin-as-secure y agrega esta IP de AWS, o interactúa con los botones rápidos y campo de texto.");
          } else {
            setMicPermissionError("El navegador bloqueó el acceso al micrófono. Por favor permite el micrófono en los permisos de la URL.");
          }
          setLiveCallStatus("idle");
        }
      };

      recognition.onend = () => {
        // Al terminar un tramo de audio, si la llamada sigue activa y Sara no está hablando ni pensando, mantener el micrófono caliente
        if (liveCallActive && liveCallStatus === "listening" && (!liveAudioElementRef.current || liveAudioElementRef.current.paused)) {
          if (!silenceTimerRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn("Speech recognition init exception:", e);
      setLiveCallStatus("idle");
    }
  };

  const sendUserLiveMessage = async (textToSend) => {
    if (!textToSend || !saraTargetGate) return;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    stopLiveCallAudio();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    setLiveInterimSpeech("");
    const userTurnItem = {
      speaker: "Contacto",
      text: textToSend,
      label: liveCallInterlocutorLabel || "Al teléfono"
    };
    const updatedHistory = [...liveCallHistory, userTurnItem];
    setLiveCallHistory(updatedHistory);
    setLiveCallUserText("");
    setLiveCallStatus("thinking");

    try {
      const res = await authFetch(`${API_BASE}/voice/chat-turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: saraTargetGate.opportunity_id,
          company_name: saraTargetGate.company_name,
          user_message: textToSend,
          conversation_history: updatedHistory,
          contact_name: saraContactName,
          contact_role: saraContactRole
        })
      });

      if (!res.ok) throw new Error("Error en respuesta de Sara");
      const data = await res.json();

      const resolvedLabel = data.interlocutor_label || liveCallInterlocutorLabel;
      if (data.interlocutor_label) {
        setLiveCallInterlocutorLabel(data.interlocutor_label);
      }
      if (data.meeting_scheduled !== undefined) {
        setLiveCallMeetingScheduled(Boolean(data.meeting_scheduled));
      }
      if (data.discovered_contact) {
        if (data.discovered_contact.name && (!saraContactName || isGenericContact(saraContactName))) {
          setSaraContactName(data.discovered_contact.name);
        }
        if (data.discovered_contact.role && (!saraContactRole || isGenericContact(saraContactRole))) {
          setSaraContactRole(data.discovered_contact.role);
        }
      }

      const newHistoryWithSara = [
        ...updatedHistory.map(h => (h.speaker === "Contacto" && (!h.label || h.label === "Al teléfono") && resolvedLabel) ? { ...h, label: resolvedLabel } : h),
        { speaker: "Sara", text: data.reply }
      ];
      setLiveCallHistory(newHistoryWithSara);

      playSaraAudioReply(data.reply, () => {
        if (data.is_farewell) {
          endLiveCall();
        } else {
          startMicrophoneRecognition();
        }
      });
    } catch (err) {
      console.error("Live turn error:", err);
      setLiveCallStatus("idle");
    }
  };

  const handleStartLiveCall = async () => {
    endLiveCall();
    setLiveCallActive(true);
    setLiveCallSeconds(0);
    setLiveCallMeetingScheduled(false);
    setLiveCallInterlocutorLabel(null);
    setLiveInterimSpeech("");
    setMicPermissionError(null);

    // Solicitar permiso de micrófono inmediatamente con el gesto del clic
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        audioStreamRef.current = stream;

        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const measure = () => {
              if (!audioStreamRef.current) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
              requestAnimationFrame(measure);
            };
            measure();
          }
        } catch (audioMeterErr) {
          console.warn("No se pudo iniciar medidor visual de audio:", audioMeterErr);
        }
      }
    } catch (permErr) {
      console.warn("Permiso de micrófono no otorgado por el usuario:", permErr);
      setMicPermissionError("No se pudo acceder al micrófono. Por favor permite el acceso en el navegador o interactúa con el teclado y los botones rápidos.");
    }

    liveTimerRef.current = setInterval(() => {
      setLiveCallSeconds((s) => s + 1);
    }, 1000);

    const cleanContact = extractCleanName(saraContactName);
    const hasKnownContact = Boolean(cleanContact);
    const greeting = getColombianGreeting();
    const companyClean = (saraTargetGate?.company_name || "su empresa")
      .replace(/ S\.A\.S\.| SAS| S\.A\.| SA| Ltda\./gi, "")
      .trim();

    let openingMsg = "";
    if (hasKnownContact) {
      const contactClean = cleanContact.replace("Simon", "Simón");
      const firstName = contactClean.split(" ")[0];
      openingMsg = `Aló, ${greeting}. Le habla Sara de INNOVAIT Transformación Digital en Medellín, ¿cómo está? ¿Tendré el gusto de hablar con Don ${firstName} o me podría comunicar con él?`;
    } else {
      openingMsg = `Aló, ${greeting}. Le habla Sara de INNOVAIT en Medellín, ¿cómo está? ¿Sería tan amable de comunicarme con la persona encargada del área de tecnología o sistemas?`;
    }

    setLiveCallHistory([{ speaker: "Sara", text: openingMsg }]);
    playSaraAudioReply(openingMsg, () => {
      startMicrophoneRecognition();
    });
  };

  const handleOpenSaraModal = async (gate) => {
    endLiveCall();
    stopAudioPlayback();
    setSaraTargetGate(gate);
    const initialPhone = gate.context_details?.contacts?.[0]?.phone || gate.key_metrics?.phone || "";
    const rawContact = gate.context_details?.contacts?.[0]?.name || gate.key_metrics?.contact || "";
    const contactName = extractCleanName(rawContact);
    const isGeneric = !contactName;
    const contactRole = gate.context_details?.contacts?.[0]?.role || (isGeneric ? "Tecnología / Sistemas" : "Líder del Área");
    setSaraPhone(initialPhone);
    setSaraContactName(contactName);
    setSaraContactRole(contactRole);
    setSaraCustomInstructions("");
    setSaraSimulationResult(null);
    setSaraDispatchedJob(null);
    setSaraActiveSubTab("preview");
    setSaraModalOpen(true);
    setSaraLoadingPrompt(true);

    try {
      const res = await authFetch(`${API_BASE}/voice/prompt/${gate.opportunity_id}?contact_name=${encodeURIComponent(contactName)}&contact_role=${encodeURIComponent(contactRole)}`);
      if (res.ok) {
        const data = await res.json();
        setSaraPrompt(data.system_prompt || "");
      } else {
        setSaraPrompt("Error cargando el prompt dinámico de Sara.");
      }
    } catch (err) {
      console.error("Error obteniendo prompt de Sara:", err);
      setSaraPrompt("Error conectando con el servicio de voz de Sara.");
    } finally {
      setSaraLoadingPrompt(false);
    }
  };

  const handleSimulateSaraCall = async () => {
    if (!saraTargetGate) return;
    setSaraSimulating(true);
    setSaraSimulationResult(null);
    try {
      const url = `${API_BASE}/voice/simulate/${saraTargetGate.opportunity_id}${saraPhone ? `?phone=${encodeURIComponent(saraPhone)}` : ""}`;
      const res = await authFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setSaraSimulationResult(data);
      setSaraActiveSubTab("simulate");
    } catch (err) {
      alert(`Error en simulación de llamada con Sara: ${err.message}`);
    } finally {
      setSaraSimulating(false);
    }
  };

  const handleDispatchToAndroid = async () => {
    if (!saraTargetGate) return;
    setSaraDispatching(true);
    try {
      const res = await authFetch(`${API_BASE}/voice/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: saraTargetGate.opportunity_id,
          phone: saraPhone || "+57 (604) 444 0000",
          contact_name: saraContactName,
          contact_role: saraContactRole,
          preferred_voice: saraVoice,
          custom_instructions: saraCustomInstructions || null,
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error ${res.status}`);
      }
      const job = await res.json();
      setSaraDispatchedJob(job);
      setSaraActiveSubTab("dispatch");
    } catch (err) {
      alert(`Error despachando llamada a cola Android: ${err.message}`);
    } finally {
      setSaraDispatching(false);
    }
  };

  const handleSaveSaraToGate3 = async () => {
    if (!saraSimulationResult && !saraDispatchedJob) return;
    setSaraSavingGate3(true);
    const source = saraSimulationResult || saraDispatchedJob;
    try {
      const res = await authFetch(`${API_BASE}/voice/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: source.job_id,
          status: "completed",
          duration_seconds: source.duration_seconds || 115,
          transcript: typeof source.transcript === "string" ? source.transcript : JSON.stringify(source.transcript || ""),
          summary: source.summary || "Contacto comercial telefónico realizado exitosamente por Sara.",
          meeting_scheduled: source.meeting_scheduled !== undefined ? source.meeting_scheduled : true,
          meeting_datetime: source.meeting_datetime || "Jueves 10:00 AM vía Google Meet / Teams",
          confirmed_email: source.confirmed_email || null,
          confirmed_phone: source.confirmed_phone || saraPhone || null,
          objections_handled: source.objections_handled || []
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      alert(`🎉 ¡Llamada registrada con éxito! La oportunidad '${saraTargetGate.company_name}' ha avanzado a Gate 3 (Validación Alcance BANT).`);
      setSaraModalOpen(false);
      await fetchData();
    } catch (err) {
      alert(`Error guardando reporte de llamada: ${err.message}`);
    } finally {
      setSaraSavingGate3(false);
    }
  };

  // Modal Radar de Prospección Autónoma (Lead Hunter Agent)
  const [radarModalOpen, setRadarModalOpen] = useState(false);
  const [radarSector, setRadarSector] = useState("Transporte de Carga y Logística");
  const [radarCity, setRadarCity] = useState("Medellín y Antioquia");
  const [radarCompanyType, setRadarCompanyType] = useState("all");
  const [radarLimit, setRadarLimit] = useState(5);
  const [radarScanning, setRadarScanning] = useState(false);
  const [radarResult, setRadarResult] = useState(null);

  const radarSectorList = [
    {
      id: "TRANSPORTE_LOGISTICA",
      name: "Transporte de Carga y Logística",
      icon: "🚛",
      pain: "Remesas físicas, guías de despacho en papel, dispersión de bodegas y demoras en liquidación de fletes.",
      solution: "INNOVAIT DocumentTrack (Tier 2/3)"
    },
    {
      id: "FINANCIERO_COOPERATIVO",
      name: "Cooperativas y Sector Financiero",
      icon: "🏦",
      pain: "Pagarés en papel, expedientes de crédito en bodegas físicas y duplicidad en base de datos de asociados.",
      solution: "DocumentTrack + Data Hygiene"
    },
    {
      id: "DISTRIBUCION_MAYORISTA",
      name: "Comercio Mayorista y Distribución",
      icon: "📦",
      pain: "Facturas de proveedores manuales, órdenes de compra físicas y desorden en catálogo de clientes.",
      solution: "DocumentTrack + Data Hygiene"
    },
    {
      id: "SALUD_CLINICAS",
      name: "Salud, Clínicas y Centros Médicos",
      icon: "🏥",
      pain: "Archivo pasivo de historias clínicas, consentimientos informados en papel y facturación CUFE/RIPS.",
      solution: "DocumentTrack Cloud + Copias Inmutables"
    },
    {
      id: "MANUFACTURA_INDUSTRIA",
      name: "Manufactura e Industria",
      icon: "🏭",
      pain: "Órdenes de producción en papel, hojas de ruta de taller y falta de respaldos inmutables en nube.",
      solution: "DocumentTrack + Landing Zone AWS"
    }
  ];

  const radarCityList = [
    "Medellín y Antioquia",
    "Bogotá D.C.",
    "Cali y Valle del Cauca",
    "Barranquilla y Costa Caribe",
    "Bucaramanga y Santanderes",
    "Eje Cafetero (Manizales, Pereira, Armenia)",
    "Nacional (Colombia)"
  ];

  const handleRunRadar = async () => {
    setRadarScanning(true);
    setRadarResult(null);
    try {
      if (apiConnected) {
        const res = await authFetch(`${API_BASE}/opportunities/hunt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sector: radarSector,
            city: radarCity,
            company_type: radarCompanyType,
            limit: Number(radarLimit)
          })
        });
        if (res.ok) {
          const data = await res.json();
          setRadarResult(data);
          await fetchData();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(`Error en el radar: ${err.detail || "No fue posible completar la prospección autónoma."}`);
        }
      } else {
        // Simulación local interactiva
        const simulated = [
          {
            company_name: "Transportes Saferbo S.A.",
            website: "https://www.saferbo.com",
            city: radarCity,
            sector: radarSector,
            key_driver: "Flujo masivo de remesas y dispersión de agencias físicas.",
            is_sme: false
          },
          {
            company_name: "Transprensa Distribución y Logística",
            website: null,
            city: radarCity,
            sector: radarSector,
            key_driver: "Archivo físico de remisiones y control en planillas Excel.",
            is_sme: true
          }
        ];
        setRadarResult({
          status: "success",
          discovered_count: simulated.length,
          sector: radarSector,
          city: radarCity,
          company_type: radarCompanyType,
          message: `Simulación local: Se descubrieron ${simulated.length} prospectos reales para ${radarSector}.`,
          opportunities: simulated
        });
      }
    } catch (e) {
      console.error("Error ejecutando radar:", e);
      alert(`Error al contactar al orquestador: ${e.message}`);
    } finally {
      setRadarScanning(false);
    }
  };

  // Prospección Automática en 1 Clic (Lead Hunter Agent Autónomo)
  const [quickHunting, setQuickHunting] = useState(false);

  const handleQuickAutoHunt = async () => {
    setQuickHunting(true);
    try {
      if (apiConnected) {
        const res = await authFetch(`${API_BASE}/opportunities/hunt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sector: "all",
            city: "Nacional (Colombia)",
            company_type: "all",
            limit: 5
          })
        });
        if (res.ok) {
          const data = await res.json();
          await fetchData();
          alert(`⚡ ¡Prospección Automática Exitosa! Se descubrieron y crearon ${data.discovered_count || 5} prospectos con datos de contacto verificados (PBX, Celular WhatsApp, correo y sede física) en Gate 1.`);
        } else {
          const err = await res.json().catch(() => ({}));
          alert(`Error en prospección: ${err.detail || "No fue posible completar la prospección autónoma."}`);
        }
      } else {
        alert("El backend no está conectado en este momento. Verifique la conexión.");
      }
    } catch (e) {
      console.error("Error ejecutando prospección automática rápida:", e);
      alert(`Error al contactar al orquestador: ${e.message}`);
    } finally {
      setQuickHunting(false);
    }
  };

  // Sembrar / Reiniciar Prospecto Demo Integral para pruebas E2E con Sara
  const [seedingDemo, setSeedingDemo] = useState(false);

  const handleSeedDemoOpportunity = async () => {
    setSeedingDemo(true);
    try {
      if (apiConnected) {
        const res = await authFetch(`${API_BASE}/opportunities/seed-demo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        if (res.ok) {
          await fetchData();
          setActiveTab("inbox");
          alert("🧪 ¡Prospecto Demo E2E listo!\n\nSe ha creado/reiniciado '[DEMO E2E] Soluciones Andinas Logística S.A.S.' en Gate 1 (Validación Target).\n\nFlujo sugerido:\n1. Revisa y aprueba Gate 1 -> Avanza a Gate 2.\n2. En Gate 2 abre '📞 Llamar con Sara' -> Ve a la pestaña 'Llamada Interactiva' y habla con Sara por micrófono.\n3. Al finalizar, guarda los hallazgos -> Pasa a Gate 3 (BANT).\n4. Aprueba Gate 3 -> Genera cotización en Gate 4.\n5. Aprueba Gate 4 -> Emite contrato en Gate 5 hasta Venta Ganada (WON).");
        } else {
          const err = await res.json().catch(() => ({}));
          alert(`Error sembrando prospecto demo: ${err.detail || "No fue posible crear el prospecto de prueba."}`);
        }
      } else {
        alert("El backend no está conectado en este momento. Verifique la conexión.");
      }
    } catch (e) {
      console.error("Error sembrando prospecto demo:", e);
      alert(`Error al contactar al orquestador: ${e.message}`);
    } finally {
      setSeedingDemo(false);
    }
  };

  // Modal Edición de Contactos
  const [editContactsModalOpen, setEditContactsModalOpen] = useState(false);
  const [editContactsTarget, setEditContactsTarget] = useState(null);
  const [editingContactsList, setEditingContactsList] = useState([]);
  const [savingContacts, setSavingContacts] = useState(false);

  const handleOpenEditContacts = (gateOrOpp) => {
    setEditContactsTarget(gateOrOpp);
    const oppId = gateOrOpp.opportunity_id;
    const fullOpp = opportunities.find((o) => o.opportunity_id === oppId);
    const existing = fullOpp?.contacts || gateOrOpp.context_details?.contacts || [];
    if (existing.length > 0) {
      setEditingContactsList(existing.map((c) => ({ ...c })));
    } else {
      setEditingContactsList([
        {
          name: "",
          role: "",
          email: "",
          phone: "",
          linkedin_url: "",
          status: "PENDING_CONTACT"
        }
      ]);
    }
    setEditContactsModalOpen(true);
  };

  const handleAddContactRow = () => {
    setEditingContactsList((prev) => [
      ...prev,
      {
        name: "",
        role: "",
        email: "",
        phone: "",
        linkedin_url: "",
        status: "PENDING_CONTACT"
      }
    ]);
  };

  const handleRemoveContactRow = (index) => {
    setEditingContactsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleContactFieldChange = (index, field, value) => {
    setEditingContactsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveContacts = async () => {
    if (!editContactsTarget) return;
    setSavingContacts(true);
    try {
      const oppId = editContactsTarget.opportunity_id;
      const validContacts = editingContactsList.filter(
        (c) => c.name?.trim() || c.email?.trim() || c.phone?.trim()
      );
      if (validContacts.length === 0) {
        alert("Por favor ingrese al menos el nombre o correo del contacto.");
        setSavingContacts(false);
        return;
      }

      if (apiConnected) {
        const res = await authFetch(`${API_BASE}/opportunities/${oppId}/contacts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validContacts)
        });
        if (res.ok) {
          await fetchData();
          setEditContactsModalOpen(false);
          alert("¡Contactos actualizados y consignados exitosamente!");
        } else {
          const err = await res.json().catch(() => ({}));
          alert(`Error al actualizar contactos: ${err.detail || "Error en el servidor"}`);
        }
      } else {
        // Simulación local
        setPendingGates((prev) =>
          prev.map((g) => {
            if (g.opportunity_id === oppId) {
              return {
                ...g,
                context_details: {
                  ...g.context_details,
                  contacts: validContacts
                },
                key_metrics: {
                  ...g.key_metrics,
                  contact: `${validContacts[0].name} (${validContacts[0].role})`
                }
              };
            }
            return g;
          })
        );
        setEditContactsModalOpen(false);
        alert("Contacto actualizado localmente.");
      }
    } catch (e) {
      console.error("Error guardando contactos:", e);
      alert(`Error de comunicación: ${e.message}`);
    } finally {
      setSavingContacts(false);
    }
  };

  // Modal Nueva Oportunidad
  const [newOppModalOpen, setNewOppModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newCountry, setNewCountry] = useState("Colombia");
  const [submitting, setSubmitting] = useState(false);

  // Modal Edición de Precios de Catálogo
  const [editCatalogModalOpen, setEditCatalogModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [pricesSaving, setPricesSaving] = useState(false);
  const [serviceDescriptions, setServiceDescriptions] = useState({
    DOC_MANAGER: "Plataforma contenerizada en Docker (Web Tier, Worker Tier, Data Tier y Storage Tier) para recepción de facturas, validación XML/CUFE y extracción OCR con modelos de IA.",
    DATA_HYGIENE: "Perfilado, deduplicación y saneamiento de registros inconsistentes, normalización de datos maestros y pipelines limpios para migración segura.",
    CLOUD_INFRA: "Modernización a contenedores, landing zones seguras, alta disponibilidad, copias inmutables, FinOps y monitoreo proactivo 24/7.",
    AI_AUTOMATION: "RAG corporativo sobre documentos y normativas, flujos de trabajo autónomos con n8n/APIs y extracción no estructurada de datos."
  });
  const [currentEditingSummary, setCurrentEditingSummary] = useState("");

  const [tierLabels, setTierLabels] = useState({
    doc_starter: "Tier Starter (2 usuarios)",
    doc_enterprise: "Tier Enterprise (8 usuarios)",
    doc_custom: "Tier Corporate Custom (25 usuarios)",
    data_audit: "Auditoría & Plan (2 semanas)",
    data_standard: "Depuración Standard (hasta 500k registros)",
    data_enterprise: "Migración Enterprise & Refactorización",
    cloud_setup: "Assessment & Setup Inicial",
    cloud_managed: "Managed Cloud Support",
    cloud_devops: "DevOps & SRE Enterprise 24/7",
    ai_poc: "PoC Fast Track (2 semanas)",
    ai_agentic: "Sistema Agéntico Productivo (6 semanas)",
    ai_enterprise: "Ecosistema de IA Enterprise (Multi-agente)"
  });

  const [customPrices, setCustomPrices] = useState({
    doc_starter_monthly: 32,
    doc_starter_impl: 49,
    doc_enterprise_monthly: 72,
    doc_enterprise_impl: 79,
    doc_custom_monthly: 200,
    doc_custom_impl: 149,
    data_audit: 1500,
    data_standard: 3800,
    data_enterprise: 9400,
    cloud_setup: 3800,
    cloud_managed: 1200,
    cloud_devops: 2800,
    ai_poc: 3500,
    ai_agentic: 8900,
    ai_enterprise: 18500
  });

  const handleOpenEditCatalog = (serviceId) => {
    setEditingServiceId(serviceId);
    setCurrentEditingSummary(serviceDescriptions[serviceId] || "");
    setEditCatalogModalOpen(true);
  };

  const handleSavePrices = async () => {
    setPricesSaving(true);
    try {
      let payloadTiers = {};
      if (editingServiceId === "DOC_MANAGER") {
        payloadTiers = {
          STARTER: { name: tierLabels.doc_starter, monthly_fee_usd: customPrices.doc_starter_monthly, max_users: 15, storage_gb: 100, implementation_fee_usd: customPrices.doc_starter_impl },
          ENTERPRISE: { name: tierLabels.doc_enterprise, monthly_fee_usd: customPrices.doc_enterprise_monthly, max_users: 100, storage_gb: 1000, implementation_fee_usd: customPrices.doc_enterprise_impl },
          CORPORATE_CUSTOM: { name: tierLabels.doc_custom, monthly_fee_usd: customPrices.doc_custom_monthly, max_users: 500, storage_gb: 5000, implementation_fee_usd: customPrices.doc_custom_impl }
        };
      } else if (editingServiceId === "DATA_HYGIENE") {
        payloadTiers = {
          AUDIT_AND_PLAN: { name: tierLabels.data_audit, fixed_fee_usd: customPrices.data_audit, duration_weeks: 2, deliverables: "Informe exhaustivo de anomalías y plan de remediación" },
          STANDARD_CLEANSING: { name: tierLabels.data_standard, fixed_fee_usd: customPrices.data_standard, duration_weeks: 4, deliverables: "Depuración hasta 500,000 registros, normalización y pipelines de carga limpia" },
          ENTERPRISE_MIGRATION: { name: tierLabels.data_enterprise, fixed_fee_usd: customPrices.data_enterprise, duration_weeks: 8, deliverables: "Limpieza profunda masiva, refactorización de esquemas y migración de BD crítica" }
        };
      } else if (editingServiceId === "CLOUD_INFRA") {
        payloadTiers = {
          CLOUD_ASSESSMENT_AND_SETUP: { name: tierLabels.cloud_setup, fixed_fee_usd: customPrices.cloud_setup, duration_weeks: 3, deliverables: "Diseño de arquitectura, landing zone segura y despliegue inicial" },
          MANAGED_CLOUD_SUPPORT: { name: tierLabels.cloud_managed, monthly_fee_usd: customPrices.cloud_managed, coverage: "Monitoreo 24/7, parches, backups y hasta 20 horas mensuales de ingeniería cloud" },
          ENTERPRISE_DEVOPS_MANAGED: { name: tierLabels.cloud_devops, monthly_fee_usd: customPrices.cloud_devops, coverage: "SRE dedicado, CI/CD, FinOps continuo y soporte con SLA de 15 minutos ante incidentes críticos" }
        };
      } else if (editingServiceId === "AI_AUTOMATION") {
        payloadTiers = {
          POC_FAST_TRACK: { name: tierLabels.ai_poc, fixed_fee_usd: customPrices.ai_poc, duration_weeks: 2, deliverables: "Prueba de concepto funcional sobre caso de uso delimitado" },
          PRODUCTION_AGENTIC_SYSTEM: { name: tierLabels.ai_agentic, fixed_fee_usd: customPrices.ai_agentic, duration_weeks: 6, deliverables: "Sistema de agentes RAG o automatización productiva integrado a BD/ERP" },
          ENTERPRISE_AI_ECOSYSTEM: { name: tierLabels.ai_enterprise, fixed_fee_usd: customPrices.ai_enterprise, duration_weeks: 10, deliverables: "Múltiples agentes orquestados, fine-tuning/RAG avanzado, observabilidad y soporte continuo" }
        };
      }

      if (editingServiceId) {
        const res = await authFetch(`${API_BASE}/catalog/service/${editingServiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: currentEditingSummary,
            pricing_tiers: payloadTiers
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `El backend devolvió código de error ${res.status}`);
        }
        setApiConnected(true);
      }

      setServiceDescriptions(prev => ({ ...prev, [editingServiceId]: currentEditingSummary }));
      setEditCatalogModalOpen(false);
      alert("¡Guardado permanente exitoso! Los cambios fueron registrados en backend/app/knowledge/services_catalog.json y en el sistema de cotización.");
    } catch (e) {
      alert(`⚠️ Error al guardar: No se pudo conectar con el Backend (${API_BASE}).\n\nDetalle: ${e.message}\n\nAsegúrate de que el backend FastAPI esté ejecutándose en el puerto 8000.`);
    } finally {
      setPricesSaving(false);
    }
  };

  // Cargar datos de Pipeline (Gates y Oportunidades) de forma periódica
  const fetchPipelineData = async () => {
    try {
      const [gatesRes, oppsRes] = await Promise.all([
        authFetch(`${API_BASE}/gates/pending`).catch(() => null),
        authFetch(`${API_BASE}/opportunities/`).catch(() => null),
      ]);

      if (gatesRes && gatesRes.status === 401) {
        handleLogout();
        return;
      }

      if (gatesRes && gatesRes.ok) {
        const gatesData = await gatesRes.json();
        setPendingGates(gatesData);
        setApiConnected(true);
      } else {
        setApiConnected(false);
        _loadFallbackData();
      }

      if (oppsRes && oppsRes.ok) {
        const oppsData = await oppsRes.json();
        setOpportunities(oppsData);
      }
    } catch (e) {
      setApiConnected(false);
    }
  };

  // Cargar datos del Catálogo Oficial (solo al inicio o al guardar)
  const fetchCatalogData = async () => {
    try {
      const catRes = await authFetch(`${API_BASE}/catalog/`).catch(() => null);
      if (catRes && catRes.ok) {
        const catData = await catRes.json();
        setCatalog(catData);
        if (catData && catData.services) {
          const descMap = {};
          const pricesUpdate = {};
          const tierLabelsUpdate = {};
          catData.services.forEach(s => {
            if (s.id && s.summary) descMap[s.id] = s.summary;
            const pt = s.pricing_tiers || {};
            if (s.id === "DOC_MANAGER") {
              if (pt.STARTER?.name) tierLabelsUpdate.doc_starter = pt.STARTER.name;
              if (pt.STARTER?.monthly_fee_usd) pricesUpdate.doc_starter_monthly = pt.STARTER.monthly_fee_usd;
              if (pt.STARTER?.implementation_fee_usd) pricesUpdate.doc_starter_impl = pt.STARTER.implementation_fee_usd;
              if (pt.ENTERPRISE?.name) tierLabelsUpdate.doc_enterprise = pt.ENTERPRISE.name;
              if (pt.ENTERPRISE?.monthly_fee_usd) pricesUpdate.doc_enterprise_monthly = pt.ENTERPRISE.monthly_fee_usd;
              if (pt.ENTERPRISE?.implementation_fee_usd) pricesUpdate.doc_enterprise_impl = pt.ENTERPRISE.implementation_fee_usd;
              if (pt.CORPORATE_CUSTOM?.name) tierLabelsUpdate.doc_custom = pt.CORPORATE_CUSTOM.name;
              if (pt.CORPORATE_CUSTOM?.monthly_fee_usd) pricesUpdate.doc_custom_monthly = pt.CORPORATE_CUSTOM.monthly_fee_usd;
              if (pt.CORPORATE_CUSTOM?.implementation_fee_usd) pricesUpdate.doc_custom_impl = pt.CORPORATE_CUSTOM.implementation_fee_usd;
            } else if (s.id === "DATA_HYGIENE") {
              if (pt.AUDIT_AND_PLAN?.name) tierLabelsUpdate.data_audit = pt.AUDIT_AND_PLAN.name;
              if (pt.AUDIT_AND_PLAN?.fixed_fee_usd) pricesUpdate.data_audit = pt.AUDIT_AND_PLAN.fixed_fee_usd;
              if (pt.STANDARD_CLEANSING?.name) tierLabelsUpdate.data_standard = pt.STANDARD_CLEANSING.name;
              if (pt.STANDARD_CLEANSING?.fixed_fee_usd) pricesUpdate.data_standard = pt.STANDARD_CLEANSING.fixed_fee_usd;
              if (pt.ENTERPRISE_MIGRATION?.name) tierLabelsUpdate.data_enterprise = pt.ENTERPRISE_MIGRATION.name;
              if (pt.ENTERPRISE_MIGRATION?.fixed_fee_usd) pricesUpdate.data_enterprise = pt.ENTERPRISE_MIGRATION.fixed_fee_usd;
            } else if (s.id === "CLOUD_INFRA") {
              if (pt.CLOUD_ASSESSMENT_AND_SETUP?.name) tierLabelsUpdate.cloud_setup = pt.CLOUD_ASSESSMENT_AND_SETUP.name;
              if (pt.CLOUD_ASSESSMENT_AND_SETUP?.fixed_fee_usd) pricesUpdate.cloud_setup = pt.CLOUD_ASSESSMENT_AND_SETUP.fixed_fee_usd;
              if (pt.MANAGED_CLOUD_SUPPORT?.name) tierLabelsUpdate.cloud_managed = pt.MANAGED_CLOUD_SUPPORT.name;
              if (pt.MANAGED_CLOUD_SUPPORT?.monthly_fee_usd) pricesUpdate.cloud_managed = pt.MANAGED_CLOUD_SUPPORT.monthly_fee_usd;
              if (pt.ENTERPRISE_DEVOPS_MANAGED?.name) tierLabelsUpdate.cloud_devops = pt.ENTERPRISE_DEVOPS_MANAGED.name;
              if (pt.ENTERPRISE_DEVOPS_MANAGED?.monthly_fee_usd) pricesUpdate.cloud_devops = pt.ENTERPRISE_DEVOPS_MANAGED.monthly_fee_usd;
            } else if (s.id === "AI_AUTOMATION") {
              if (pt.POC_FAST_TRACK?.name) tierLabelsUpdate.ai_poc = pt.POC_FAST_TRACK.name;
              if (pt.POC_FAST_TRACK?.fixed_fee_usd) pricesUpdate.ai_poc = pt.POC_FAST_TRACK.fixed_fee_usd;
              if (pt.PRODUCTION_AGENTIC_SYSTEM?.name) tierLabelsUpdate.ai_agentic = pt.PRODUCTION_AGENTIC_SYSTEM.name;
              if (pt.PRODUCTION_AGENTIC_SYSTEM?.fixed_fee_usd) pricesUpdate.ai_agentic = pt.PRODUCTION_AGENTIC_SYSTEM.fixed_fee_usd;
              if (pt.ENTERPRISE_AI_ECOSYSTEM?.name) tierLabelsUpdate.ai_enterprise = pt.ENTERPRISE_AI_ECOSYSTEM.name;
              if (pt.ENTERPRISE_AI_ECOSYSTEM?.fixed_fee_usd) pricesUpdate.ai_enterprise = pt.ENTERPRISE_AI_ECOSYSTEM.fixed_fee_usd;
            }
          });
          setServiceDescriptions(prev => ({ ...prev, ...descMap }));
          setCustomPrices(prev => ({ ...prev, ...pricesUpdate }));
          setTierLabels(prev => ({ ...prev, ...tierLabelsUpdate }));
        }
      }
    } catch (e) {
      console.warn("Backend FastAPI offline para catálogo:", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPipelineData(), fetchCatalogData()]);
    setLoading(false);
  };

  const _loadFallbackData = () => {
    // Datos demostrativos para previsualización inmediata
    const samplePending = [
      {
        opportunity_id: "opp_demo_001",
        company_name: "Transportes Interandinos S.A.",
        gate_type: "GATE_1_TARGET",
        status: "PENDING",
        headline: "Validación de Target: Transportes Interandinos S.A.",
        agent_name: "Scraper & Enricher Agent (Apollo/Hunter)",
        recommendation_summary: "Ajuste ICP 92/100. Stack legacy detectado (Windows Server + SQL Server desnormalizado). Gran fit para DocumentTrack.",
        key_metrics: { fit_score: 92, stack: ["Windows Server", "SQL Server 2012", "Carpetas SMB"] },
        waiting_since: new Date().toISOString(),
      },
      {
        opportunity_id: "opp_demo_002",
        company_name: "Seguros & Finanzas del Caribe",
        gate_type: "GATE_2_OUTREACH",
        status: "PENDING",
        headline: "Aprobación de Primer Contacto: Seguros & Finanzas del Caribe",
        agent_name: "SDR / Outreach Agent",
        recommendation_summary: "Hola Carlos Mendoza,\n\nNotamos que en Seguros & Finanzas del Caribe gestionan un volumen superior a 15,000 facturas y pólizas mensuales donde la validación de XML/CUFE y la extracción OCR manual representan demoras operativas.\n\nCon nuestra plataforma DocumentTrack (desplegada en AWS/GCP bajo arquitectura ISO 27001), automatizamos la ingesta de documentos y la verificación tributaria en segundos con modelos de IA, reduciendo costos de almacenamiento mediante políticas de archivo frío (Glacier).\n\n¿Tendrías 15 minutos este jueves para mostrarte cómo opera sin alterar sus sistemas actuales?",
        key_metrics: { channel: "EMAIL", contact: "Carlos Mendoza (Head of IT)", subject: "Optimización de validación CUFE y extracción OCR en Seguros del Caribe" },
        waiting_since: new Date().toISOString(),
      },
      {
        opportunity_id: "opp_demo_003",
        company_name: "Clínica Médica de Especialidades",
        gate_type: "GATE_4_ARCHITECT",
        status: "PENDING",
        headline: "Revisión de Arquitectura y Pricing: Clínica Médica",
        agent_name: "Solutions Architect Agent (RAG DocumentTrack)",
        recommendation_summary: "Propuesta DocumentTrack Tier Enterprise: Recepción centralizada de expedientes, validación XML/CUFE, OCR con IA y Saneamiento de Base de Datos.",
        key_metrics: { implementation_fee_usd: 6800, annual_license_usd: 18000, managed_services_monthly_usd: 1200, discount_percentage: 10, sizing_tier: "Tier Enterprise", compliance: "ISO 27001" },
        context_details: {
          pain_points: [
            "Archivo físico en bodega con más de 120,000 historias clínicas y pagarés en papel",
            "Duplicidad de registros de pacientes y expedientes entre sedes",
            "Servidores locales antiguos on-premise sin respaldo cloud ante contingencias"
          ],
          stack: ["Windows Server 2012", "SQL Server Express", "Carpetas Compartidas SMB"],
          contacts: [
            { name: "Dra. Carolina Martínez", role: "Directora Administrativa", email: "carolina.martinez@clinicamedica.com", linkedin_url: "https://linkedin.com" },
            { name: "Ing. Roberto Salazar", role: "Director de TI & Sistemas", email: "roberto.salazar@clinicamedica.com", linkedin_url: "https://linkedin.com" }
          ],
          discovery_need: "Eliminar el archivo físico en bodega mediante digitalización OCR y sanear base de datos histórica.",
          technical_requirements: [
            "Extracción inteligente de metadatos mediante OCR asistido por IA",
            "Depuración de base de datos desnormalizada (hasta 500k registros)",
            "Despliegue cloud contenerizado en AWS con cifrado de grado médico y respaldos inmutables"
          ],
          pricing_breakdown: [
            {
              concept: "Servicio Especializado de Depuración de Base de Datos",
              package_tier: "Standard Cleansing (hasta 500k registros)",
              fee_display: "$6,800 USD fijo",
              catalog_source: "services_catalog.json ➔ DATA_HYGIENE -> STANDARD_CLEANSING",
              justification: "Saneamiento de anomalías, eliminación de duplicidad de registros y creación de pipelines limpios."
            },
            {
              concept: "Licencia Anual Plataforma DocumentTrack",
              package_tier: "Tier Empresarial ($1,500 USD/mes × 12 meses)",
              fee_display: "$18,000 USD/año",
              catalog_source: "services_catalog.json ➔ DOC_MANAGER -> ENTERPRISE",
              justification: "Recepción centralizada de expedientes, validación XML/CUFE y motor de extracción OCR con IA."
            },
            {
              concept: "Administración, Seguridad y Soporte Cloud 24/7",
              package_tier: "Managed Cloud Support",
              fee_display: "$1,200 USD/mes",
              catalog_source: "services_catalog.json ➔ CLOUD_INFRA -> MANAGED_CLOUD_SUPPORT",
              justification: "Despliegue de landing zone segura en AWS, copias inmutables contra ransomware y monitoreo proactivo 24/7."
            }
          ]
        },
        waiting_since: new Date().toISOString(),
      }
    ];
    setPendingGates(samplePending);
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchData();
    // Refrescar únicamente pipeline y compuertas en segundo plano para no sobreescribir el catálogo
    const interval = setInterval(() => {
      fetchPipelineData();
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Manejar decisiones Human-in-the-Loop
  const handleDecision = async (oppId, action, feedback = null, modifications = null) => {
    setSubmitting(true);
    try {
      const payload = {
        action: action, // "APPROVE" | "MODIFY" | "OVERRIDE"
        feedback: feedback,
        modifications: modifications,
        user_name: "Director Comercial (Comando Central)"
      };

      if (apiConnected) {
        const res = await authFetch(`${API_BASE}/gates/${oppId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          await fetchData();
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("Error from backend:", errData);
          alert(`Error del orquestador (${res.status}): ${errData.detail || "No fue posible registrar la decisión."}`);
          return;
        }
      } else {
        // Simulación interactiva local
        setPendingGates(prev => prev.filter(p => p.opportunity_id !== oppId));
        alert(`Decisión [${action}] registrada exitosamente para la oportunidad.`);
      }
    } catch (e) {
      console.error("Error enviando decisión:", e);
      alert(`Error de comunicación con el orquestador: ${e.message || "Verifique la conexión al backend."}`);
    } finally {
      setSubmitting(false);
      setModifyModalOpen(false);
      setFeedbackText("");
      setDiscountValue("");
    }
  };

  // Crear nueva oportunidad
  const handleCreateOpportunity = async (e) => {
    e.preventDefault();
    if (!newCompany) return;
    setSubmitting(true);

    try {
      if (apiConnected) {
        const res = await authFetch(`${API_BASE}/opportunities/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: newCompany,
            website: newWebsite,
            country: newCountry
          })
        });
        if (res.ok) {
          await fetchData();
          setNewOppModalOpen(false);
          setNewCompany("");
          setNewWebsite("");
        }
      } else {
        const fakeId = `opp_demo_${Date.now()}`;
        setPendingGates(prev => [
          {
            opportunity_id: fakeId,
            company_name: newCompany,
            gate_type: "GATE_1_TARGET",
            status: "PENDING",
            headline: `Validación de Target: ${newCompany}`,
            agent_name: "Scraper & Enricher Agent (Apollo/Hunter)",
            recommendation_summary: "Perfilado completado con fuentes externas. ICP Fit Score calculado.",
            key_metrics: { fit_score: 87 },
            waiting_since: new Date().toISOString()
          },
          ...prev
        ]);
        setNewOppModalOpen(false);
        setNewCompany("");
        setNewWebsite("");
      }
    } catch (e) {
      alert("Error creando oportunidad.");
    } finally {
      setSubmitting(false);
    }
  };

  const getGateBadge = (gateType) => {
    switch (gateType) {
      case "GATE_1_TARGET":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Gate 1: Validación Target</span>;
      case "GATE_2_OUTREACH":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Gate 2: Aprobación Outreach</span>;
      case "GATE_3_DISCOVERY":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Gate 3: Validación Alcance BANT</span>;
      case "GATE_4_ARCHITECT":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Gate 4: Arquitectura & Pricing</span>;
      case "GATE_5_LEGAL":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Gate 5: Firma & Términos Legales</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{gateType}</span>;
    }
  };

  // Pantalla de carga mientras se verifica el token JWT inicial
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-blue-500/20 animate-pulse">
            IN
          </div>
          <div className="flex items-center space-x-2 text-slate-300 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            <span>Verificando sesión segura INNOVAIT...</span>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de Inicio de Sesión y 2FA si no hay usuario autenticado
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Luces de ambiente decorativas */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-black/40">
            {/* Logotipo & Título */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/20 mb-3">
                IN
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">INNOVAIT Sales Engine</h1>
              <p className="text-xs text-slate-400 mt-1">
                Command Center B2B • Acceso Restringido & 2FA
              </p>
            </div>

            {/* Banner de Error */}
            {authError && (
              <div className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-start space-x-2.5 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{authError}</span>
              </div>
            )}

            {/* PASO 1: CREDENCIALES (USUARIO Y CONTRASEÑA) */}
            {authStep === "credentials" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Usuario o Correo Corporativo
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {authLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verificando credenciales...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        <span>Iniciar Sesión</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 text-center">
                  <span className="font-medium text-slate-300">Credenciales iniciales:</span>
                  <div className="mt-0.5 font-mono text-slate-400">Usuario: <span className="text-cyan-400 font-semibold">admin</span> • Contraseña: <span className="text-cyan-400 font-semibold">AdminPassword2026!</span></div>
                </div>
              </form>
            )}

            {/* PASO 2A: ENROLAMIENTO 2FA (PRIMER INICIO) */}
            {authStep === "2fa_setup" && (
              <form onSubmit={handle2FASetupSubmit} className="space-y-4">
                <div className="text-center mb-4">
                  <div className="inline-flex p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h2 className="text-base font-bold text-white">Configurar Autenticador (2FA)</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Escanee este código con Google Authenticator o Microsoft Authenticator en su móvil.
                  </p>
                </div>

                {/* Contenedor del Código QR */}
                {authQrCodeUrl && (
                  <div className="bg-white p-3 rounded-2xl shadow-inner mx-auto w-48 h-48 flex items-center justify-center border border-slate-700/50">
                    <img
                      src={authQrCodeUrl}
                      alt="Código QR 2FA"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* Clave Secreta Manual */}
                {authTotpSecret && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-400 text-center">
                      ¿No puede escanear? Ingrese esta clave manualmente en su app:
                    </label>
                    <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700 flex items-center justify-between text-xs font-mono text-cyan-300">
                      <span className="truncate mr-2 select-all">{authTotpSecret}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator?.clipboard) {
                            navigator.clipboard.writeText(authTotpSecret);
                            setSecretCopied(true);
                            setTimeout(() => setSecretCopied(false), 2000);
                          }
                        }}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-sans flex items-center space-x-1 shrink-0 cursor-pointer"
                      >
                        {secretCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{secretCopied ? "Copiada" : "Copiar"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Input de 6 dígitos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                    Código de 6 dígitos que muestra su app
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={authTotpCode}
                    onChange={(e) => setAuthTotpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full text-center text-2xl font-mono tracking-widest py-2.5 bg-slate-800/90 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="submit"
                    disabled={authLoading || authTotpCode.length < 6}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {authLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Validando código 2FA...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Activar 2FA e Ingresar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("credentials");
                      setAuthError("");
                      setAuthTotpCode("");
                    }}
                    className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    ← Volver a inicio de sesión
                  </button>
                </div>
              </form>
            )}

            {/* PASO 2B: VERIFICACIÓN 2FA (INICIOS POSTERIORES) */}
            {authStep === "2fa_verify" && (
              <form onSubmit={handle2FAVerifySubmit} className="space-y-4">
                <div className="text-center mb-4">
                  <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h2 className="text-base font-bold text-white">Verificación en Dos Pasos (2FA)</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Abra Google Authenticator en su móvil e ingrese el código de 6 dígitos.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                    Código de Seguridad
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={authTotpCode}
                    onChange={(e) => setAuthTotpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full text-center text-3xl font-mono tracking-[0.4em] py-3 bg-slate-800/90 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="submit"
                    disabled={authLoading || authTotpCode.length < 6}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {authLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verificar y Entrar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("credentials");
                      setAuthError("");
                      setAuthTotpCode("");
                    }}
                    className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    ← Volver a inicio de sesión
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-md">
              IN
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">INNOVAIT</h1>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-200">
                  Sales HITL Engine
                </span>
              </div>
              <p className="text-xs text-slate-500">Command Center Multi-Agente B2B • LangGraph + Gemini</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${apiConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
              <span className="text-slate-600 font-medium">
                {apiConnected ? "Backend LangGraph Conectado (Port 8000)" : "Modo Interactivo Local"}
              </span>
            </div>

            <button
              onClick={handleQuickAutoHunt}
              disabled={quickHunting}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-bold shadow-sm shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
              title="Descubrir automáticamente 5 prospectos reales con contactos verificados"
            >
              {quickHunting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-100" />
                  <span>Prospectando...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-100" />
                  <span>⚡ Prospección Automática</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setRadarResult(null);
                setRadarModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-sm font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4 text-emerald-100" />
              <span>🛰️ Radar de Prospección</span>
            </button>

            <button
              onClick={handleSeedDemoOpportunity}
              disabled={seedingDemo}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 text-white text-sm font-bold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
              title="Sembrar o reiniciar prospecto de prueba integral ('Soluciones Andinas Logística') en Gate 1 para probar todo el ciclo comercial y llamadas interactivas con Sara"
            >
              {seedingDemo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                  <span>Cargando Demo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>🧪 Demo E2E (Llamada Sara)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setNewOppModalOpen(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Prospecto</span>
            </button>

            {/* Perfil de Usuario Autenticado & Botón de Salir */}
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : "AD"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">
                    {currentUser?.name || "Administrador"}
                  </p>
                  <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>2FA Activo</span>
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-medium transition-all cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aprobaciones Pendientes</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">{pendingGates.length}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Requieren decisión humana</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Flota de Agentes</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">6 Agentes</h3>
              <p className="text-xs text-indigo-600 font-semibold mt-0.5 flex items-center">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-500" /> Sara Voz + Gemini 2.5 Flash/Pro
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Producto Insignia</p>
              <h3 className="text-lg font-black text-slate-900 mt-1">DocumentTrack</h3>
              <p className="text-xs text-slate-500 mt-0.5">Gestión Documental & OCR</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Enriquecimiento</p>
              <h3 className="text-lg font-black text-slate-900 mt-1">Apollo + Hunter</h3>
              <p className="text-xs text-slate-500 mt-0.5">Stack & Emails Verificados</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 space-x-6 mb-6">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === "inbox"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Bandeja de Aprobaciones (Approval Inbox)</span>
            {pendingGates.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-bold">
                {pendingGates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("kanban")}
            className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === "kanban"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pipeline Kanban</span>
          </button>

          <button
            onClick={() => setActiveTab("catalog")}
            className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === "catalog"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Catálogo de Soluciones INNOVAIT</span>
          </button>
        </div>

        {/* TAB 1: APPROVAL INBOX */}
        {activeTab === "inbox" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">
                Oportunidades pausadas en compuertas de decisión. Cada acción dispara inmediatamente el siguiente agente o re-ejecuta con feedback.
              </p>
              <div className="flex items-center space-x-2">
                {pendingGates.length > 0 && (
                  <>
                    <button
                      onClick={handleCollapseAll}
                      className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                      title="Contraer todas las tarjetas de prospectos para facilitar la navegación"
                    >
                      <ChevronsDownUp className="w-3.5 h-3.5 text-slate-500" />
                      <span>Contraer Todos</span>
                    </button>
                    <button
                      onClick={handleExpandAll}
                      className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                      title="Expandir todas las tarjetas de prospectos"
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
                      <span>Expandir Todos</span>
                    </button>
                  </>
                )}
                <button
                  onClick={fetchData}
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {pendingGates.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">¡Bandeja al día! No hay compuertas pendientes</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  Todos los prospectos y propuestas han sido aprobados o procesados por los agentes. Puedes crear un nuevo prospecto para iniciar el ciclo.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleQuickAutoHunt}
                    disabled={quickHunting}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-bold shadow-sm shadow-orange-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {quickHunting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-100" />
                        <span>Prospectando...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-100" />
                        <span>⚡ Prospección Automática (1 Clic)</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setRadarResult(null);
                      setRadarModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-sm font-bold shadow-sm shadow-emerald-600/20 cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-emerald-100" />
                    <span>🛰️ Activar Radar de Prospección</span>
                  </button>
                  <button
                    onClick={handleSeedDemoOpportunity}
                    disabled={seedingDemo}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 text-white text-sm font-bold shadow-sm shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>🧪 Cargar Demo E2E (Llamada Sara)</span>
                  </button>
                  <button
                    onClick={() => setNewOppModalOpen(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold border border-slate-200 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ingresar Manual</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingGates.map((gate) => {
                  const isCollapsed = !!collapsedCards[gate.opportunity_id];
                  return (
                    <div
                      key={gate.opportunity_id}
                      className={`bg-white rounded-2xl border border-slate-200 shadow-sm transition-all flex flex-col justify-between ${
                        isCollapsed ? "p-4 hover:border-blue-300 hover:shadow-md" : "p-6 hover:shadow-md"
                      }`}
                    >
                      {/* HEADER DE LA COMPUERTA / PROSPECTO */}
                      <div
                        onClick={() => toggleCardCollapse(gate.opportunity_id)}
                        className="flex items-center justify-between cursor-pointer select-none group"
                        title={isCollapsed ? "Clic para expandir prospecto" : "Clic para contraer prospecto"}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0 pr-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCardCollapse(gate.opportunity_id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors shrink-0"
                            aria-label={isCollapsed ? "Expandir" : "Contraer"}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                            )}
                          </button>

                          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                              <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                {gate.company_name}
                              </h3>
                              {getGateBadge(gate.gate_type)}
                              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">
                                {gate.agent_name}
                              </span>
                            </div>

                            {/* Vista resumen compacta cuando está contraído */}
                            {isCollapsed && (
                              <div className="mt-1 flex items-center space-x-3 text-xs text-slate-500 truncate">
                                <span className="truncate">
                                  {gate.gate_type === "GATE_2_OUTREACH" ? (
                                    <>
                                      <span>✉️ Asunto: {gate.context_details?.subject || gate.key_metrics?.subject || "Propuesta comercial"}</span>
                                      <span className="mx-1">•</span>
                                      <span>👤 Destinatario: {gate.key_metrics?.contact || "Tomador de decisión"}</span>
                                      {(gate.context_details?.contacts?.[0]?.phone || gate.key_metrics?.phone) && (
                                        <>
                                          <span className="mx-1">•</span>
                                          <span className="text-emerald-700 font-semibold">📞 {gate.context_details?.contacts?.[0]?.phone || gate.key_metrics?.phone}</span>
                                        </>
                                      )}
                                    </>
                                  ) : gate.gate_type === "GATE_1_TARGET" ? (
                                    <>
                                      <span>🎯 Match: {gate.key_metrics?.fit_score || 85}/100</span>
                                      {(gate.context_details?.contacts?.[0]?.name || gate.key_metrics?.contact) && (
                                        <>
                                          <span className="mx-1">•</span>
                                          <span className="font-semibold text-slate-700">👤 {gate.context_details?.contacts?.[0]?.name || gate.key_metrics?.contact}</span>
                                        </>
                                      )}
                                      {(gate.context_details?.contacts?.[0]?.phone || gate.key_metrics?.phone) && (
                                        <>
                                          <span className="mx-1">•</span>
                                          <span className="text-emerald-700 font-semibold">📞 {gate.context_details?.contacts?.[0]?.phone || gate.key_metrics?.phone}</span>
                                        </>
                                      )}
                                      {(gate.context_details?.contacts?.[0]?.email || gate.key_metrics?.email) && (
                                        <>
                                          <span className="mx-1">•</span>
                                          <span className="text-indigo-700 font-mono">✉️ {gate.context_details?.contacts?.[0]?.email || gate.key_metrics?.email}</span>
                                        </>
                                      )}
                                      {gate.context_details?.address && (
                                        <>
                                          <span className="mx-1">•</span>
                                          <span className="text-slate-600">📍 {gate.context_details.address}</span>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    gate.recommendation_summary ? gate.recommendation_summary.replace(/\n/g, " ").slice(0, 140) + "..." : "Pausado en espera de decisión humana"
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          {isCollapsed && gate.key_metrics?.fit_score && (
                            <span className="hidden sm:inline-flex bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold text-emerald-700 text-xs">
                              Match: {gate.key_metrics.fit_score}/100
                            </span>
                          )}
                          {isCollapsed && (gate.key_metrics?.implementation_fee_usd || gate.key_metrics?.annual_license_usd) && (
                            <span className="hidden md:inline-flex bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-slate-800 text-xs">
                              Total: ${(Number(gate.key_metrics?.implementation_fee_usd || 0) + Number(gate.key_metrics?.annual_license_usd || 0)).toLocaleString()} USD
                            </span>
                          )}
                          <span className="text-xs text-slate-400 hidden sm:flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Pausado
                          </span>
                          <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-800 bg-blue-50/60 group-hover:bg-blue-100/60 px-2.5 py-1 rounded-lg border border-blue-100 transition-colors">
                            {isCollapsed ? "Expandir" : "Contraer"}
                          </span>
                        </div>
                      </div>

                      {/* CUERPO COMPLETO Y ACCIONES (Solo cuando está expandido) */}
                      {!isCollapsed && (
                        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in duration-150">
                          <div>
                            <div className="mt-1 bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-center space-x-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Agente Responsable:</span>
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {gate.agent_name}
                          </span>
                        </div>
                        {gate.gate_type === "GATE_2_OUTREACH" ? (
                          <div className="mt-2 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                            {/* Selector de Canal / Formato de Outreach */}
                            <div className="bg-slate-100/90 px-3.5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveOutreachTabs((prev) => ({ ...prev, [gate.opportunity_id]: "whatsapp" }))}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                                    getOutreachTab(gate) === "whatsapp"
                                      ? "bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700"
                                      : "bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200"
                                  }`}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>🟢 WhatsApp Ejecutivo</span>
                                  {gate.context_details?.is_sme && (
                                    <span className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.2 rounded-full font-extrabold">PyME</span>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setActiveOutreachTabs((prev) => ({ ...prev, [gate.opportunity_id]: "call" }))}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                                    getOutreachTab(gate) === "call"
                                      ? "bg-blue-600 text-white shadow-xs ring-1 ring-blue-700"
                                      : "bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200"
                                  }`}
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  <span>📞 Guion Telefónico (3 Pasos)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setActiveOutreachTabs((prev) => ({ ...prev, [gate.opportunity_id]: "email" }))}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                                    getOutreachTab(gate) === "email"
                                      ? "bg-purple-600 text-white shadow-xs ring-1 ring-purple-700"
                                      : "bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200"
                                  }`}
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  <span>✉️ Correo Corporativo</span>
                                </button>
                              </div>

                              {gate.key_metrics?.contact && (
                                <span className="text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200 shrink-0 inline-flex items-center">
                                  <span>Contacto: <strong className="text-slate-900">{gate.key_metrics.contact}</strong></span>
                                  {gate.context_details?.contacts?.[0]?.phone && (
                                    <span className="ml-1.5 text-emerald-700 font-bold">
                                      ({gate.context_details.contacts[0].phone})
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditContacts(gate)}
                                    className="ml-2 text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1 rounded-md border border-indigo-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                                    title="Modificar o consignar correo/teléfono de contacto"
                                  >
                                    <Pencil className="w-3 h-3 text-indigo-700" />
                                    <span className="text-[10px] font-bold text-indigo-700">Editar</span>
                                  </button>
                                </span>
                              )}
                            </div>

                            {/* PESTAÑA: WHATSAPP */}
                            {getOutreachTab(gate) === "whatsapp" && (
                              <div className="p-4 bg-emerald-50/20">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-900">
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Mensaje Directo para WhatsApp Business / Celular del Tomador de Decisión</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(gate.context_details?.whatsapp_message || gate.recommendation_summary, gate.opportunity_id)}
                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 transition-colors flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar Mensaje WhatsApp</span>
                                  </button>
                                </div>
                                <div className="bg-white rounded-lg p-4 border border-emerald-100 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-line shadow-2xs">
                                  {gate.context_details?.whatsapp_message || "Mensaje de WhatsApp para tomador de decisión listo."}
                                </div>
                              </div>
                            )}

                            {/* PESTAÑA: GUION TELEFÓNICO */}
                            {getOutreachTab(gate) === "call" && (
                              <div className="p-4 bg-blue-50/20">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-900">
                                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Estructura de Llamada: Paso 1 (Filtro Recepción) ➔ Paso 2 (Pitch Dueño) ➔ Paso 3 (Cierre Demo 15 min)</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(gate.context_details?.call_script || gate.recommendation_summary, gate.opportunity_id)}
                                    className="text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-100/70 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 transition-colors flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar Guion Completo</span>
                                  </button>
                                </div>
                                <div className="bg-white rounded-lg p-4 border border-blue-100 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-line max-h-96 overflow-y-auto shadow-2xs">
                                  {gate.context_details?.call_script || "Guion de llamada telefónica listo."}
                                </div>
                              </div>
                            )}

                            {/* PESTAÑA: CORREO CORPORATIVO */}
                            {getOutreachTab(gate) === "email" && (
                              <div>
                                <div className="bg-purple-50/50 px-4 py-2.5 border-b border-purple-100 text-xs flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2">
                                    <Mail className="w-4 h-4 text-purple-600" />
                                    <span className="font-bold text-slate-800">
                                      Asunto: {gate.context_details?.subject || gate.key_metrics?.subject || "INNOVAIT | Transformación digital y eficiencia operativa"}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(`Asunto: ${gate.context_details?.subject || gate.key_metrics?.subject}\n\n${gate.context_details?.body_markdown || gate.recommendation_summary}`, gate.opportunity_id)}
                                    className="text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-100/70 hover:bg-purple-100 px-2.5 py-1 rounded-md border border-purple-200 transition-colors flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar Correo</span>
                                  </button>
                                </div>
                                <div className="p-4 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-line max-h-80 overflow-y-auto">
                                  {gate.context_details?.body_markdown || gate.recommendation_summary}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-line">
                            {gate.recommendation_summary}
                          </p>
                        )}

                        {/* Métricas clave detectadas */}
                        {gate.key_metrics && Object.keys(gate.key_metrics).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap gap-2 text-xs text-slate-600">
                            {gate.key_metrics.fit_score && (
                              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-emerald-700">
                                Match ICP: {gate.key_metrics.fit_score}/100
                              </span>
                            )}
                            {gate.key_metrics.implementation_fee_usd && (
                              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-slate-800">
                                Impl Fee: USD ${gate.key_metrics.implementation_fee_usd.toLocaleString()}
                              </span>
                            )}
                            {gate.key_metrics.annual_license_usd && (
                              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-slate-800">
                                Licencia Anual: USD ${gate.key_metrics.annual_license_usd.toLocaleString()}
                              </span>
                            )}
                            {gate.key_metrics.channel && (
                              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-purple-700">
                                Canal: {gate.key_metrics.channel}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Barra de Expansión / Acceso a Sustentación */}
                        <div className="mt-4 pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGateDetails((prev) => ({
                                ...prev,
                                [gate.opportunity_id]: !prev[gate.opportunity_id],
                              }))
                            }
                            className="inline-flex items-center space-x-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-xl border border-blue-200 transition-all shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>
                              {expandedGateDetails[gate.opportunity_id]
                                ? "Ocultar Sustentación Técnica, Contactos y Precios"
                                : "🔍 Ver Sustentación Completa de Precios, Contactos y Dolores Detectados"}
                            </span>
                            {expandedGateDetails[gate.opportunity_id] ? (
                              <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                            )}
                          </button>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setMasterCatalogModalOpen(true)}
                              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs transition-all"
                            >
                              <FileCode className="w-3.5 h-3.5 text-blue-600" />
                              <span>Ver Archivo Maestro (services_catalog.json)</span>
                            </button>
                          </div>
                        </div>

                        {/* Contenido Desplegable de Sustentación */}
                        {expandedGateDetails[gate.opportunity_id] && (
                          <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-4 animate-in fade-in duration-200">
                            {/* 1. SECCIÓN DE SUSTENTACIÓN DE PRECIOS Y FÓRMULAS (GATE 4) */}
                            {gate.gate_type === "GATE_4_ARCHITECT" && (
                              <div className="bg-gradient-to-br from-blue-50/60 via-indigo-50/40 to-slate-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <DollarSign className="w-4 h-4 text-blue-700" />
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                      Sustentación de Precios y Fórmulas de Cotización
                                    </h4>
                                  </div>
                                  <button
                                    onClick={() => setMasterCatalogModalOpen(true)}
                                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline flex items-center space-x-1"
                                  >
                                    <span>Ver matriz oficial en services_catalog.json</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>

                                <p className="text-xs text-slate-600">
                                  Los valores han sido orquestados por el <strong>Agente Solutions Architect</strong> cruzando los requerimientos técnicos levantados en el diagnóstico con el tarifario base oficial de INNOVAIT:
                                </p>

                                {/* Desglose de cada rubro */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {/* Rubro 1: Depuración BD */}
                                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                          Implementación Fija
                                        </span>
                                        <Database className="w-4 h-4 text-purple-600" />
                                      </div>
                                      <h5 className="text-xs font-bold text-slate-800 mt-1">
                                        Depuración de Base de Datos
                                      </h5>
                                      <p className="text-xs font-extrabold text-slate-900 mt-1">
                                        ${gate.key_metrics?.implementation_fee_usd?.toLocaleString() || "6,800"} USD
                                      </p>
                                      <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                                        <p>
                                          <strong>Nivel:</strong> Standard Cleansing (hasta 500k registros).
                                        </p>
                                        <p>
                                          <strong>Origen:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-purple-800">services_catalog.json ➔ DATA_HYGIENE</code>
                                        </p>
                                        <p className="text-slate-500 italic text-[10px] pt-1">
                                          Justificación: Diagnóstico identificó ~300k registros desnormalizados con duplicidad e inconsistencia en datos maestros.
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Rubro 2: Licencia DocumentTrack */}
                                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                          Licenciamiento Anual
                                        </span>
                                        <FileText className="w-4 h-4 text-blue-600" />
                                      </div>
                                      <h5 className="text-xs font-bold text-slate-800 mt-1">
                                        Plataforma DocumentTrack
                                      </h5>
                                      <p className="text-xs font-extrabold text-slate-900 mt-1">
                                        ${gate.key_metrics?.annual_license_usd?.toLocaleString() || "18,000"} USD/año
                                      </p>
                                      <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                                        <p>
                                          <strong>Nivel:</strong> Tier Enterprise ($1,500 USD/mes × 12 meses).
                                        </p>
                                        <p>
                                          <strong>Origen:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-blue-800">services_catalog.json ➔ DOC_MANAGER</code>
                                        </p>
                                        <p className="text-slate-500 italic text-[10px] pt-1">
                                          Justificación: Sustitución total del archivo físico en bodega mediante OCR semántico con IA y validación XML/CUFE.
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Rubro 3: Soporte Cloud */}
                                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                          Operación Mensual
                                        </span>
                                        <Cloud className="w-4 h-4 text-emerald-600" />
                                      </div>
                                      <h5 className="text-xs font-bold text-slate-800 mt-1">
                                        Managed Cloud Support AWS
                                      </h5>
                                      <p className="text-xs font-extrabold text-slate-900 mt-1">
                                        ${gate.key_metrics?.managed_services_monthly_usd?.toLocaleString() || "1,200"} USD/mes
                                      </p>
                                      <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                                        <p>
                                          <strong>Nivel:</strong> Managed Cloud Support (24/7 + SLA de soporte).
                                        </p>
                                        <p>
                                          <strong>Origen:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-emerald-800">services_catalog.json ➔ CLOUD_INFRA</code>
                                        </p>
                                        <p className="text-slate-500 italic text-[10px] pt-1">
                                          Justificación: Mitiga vulnerabilidad de servidores on-premise mediante landing zone segura en AWS y copias inmutables.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 2. SECCIÓN: TOMADORES DE DECISIÓN Y CONTACTOS CLAVE */}
                            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center space-x-2">
                                  <Users className="w-4 h-4 text-indigo-600" />
                                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                    Contactos Clave y Tomadores de Decisión Detectados
                                  </h4>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditContacts(gate)}
                                    className="text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                                  >
                                    <Pencil className="w-3 h-3 text-indigo-600" />
                                    <span>Editar / Consignar Contacto</span>
                                  </button>
                                  <span className="text-[11px] text-slate-500">
                                    Enriquecido vía Apollo.io & Hunter.io
                                  </span>
                                </div>
                              </div>

                              {/* Sede Principal y NIT Verificado */}
                              {(gate.context_details?.tax_id || gate.context_details?.address) && (
                                <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                                  <div className="flex items-center space-x-2 text-slate-700">
                                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                                    <span><strong>Sede Principal:</strong> {gate.context_details?.address || "Colombia"}</span>
                                  </div>
                                  {gate.context_details?.tax_id && (
                                    <span className="text-slate-600 font-mono text-[11px] bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                                      <strong>NIT:</strong> {gate.context_details.tax_id}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                                {(gate.context_details?.contacts && gate.context_details.contacts.length > 0
                                  ? gate.context_details.contacts
                                  : [
                                      { name: "Javier Andrés Loaiza Mira", role: "Subgerente de Tecnología e Informática", email: "javier.loaiza@jfk.com.co", linkedin_url: "https://www.linkedin.com/in/javier-andr%C3%A9s-loaiza-mira-15886361/" },
                                      { name: "Colette Rodriguez", role: "Directora de Agencia", email: "colette.rodriguez@jfk.com.co", linkedin_url: "https://www.linkedin.com/in/colette-rodriguez-466a9388" },
                                      { name: "Leidy Garcia", role: "Directora Contabilidad", email: "leidy.garcia@jfk.com.co", linkedin_url: "https://www.linkedin.com/in/leidy-garcia-8348b615a" }
                                    ]
                                ).map((contact, cIdx) => (
                                  <div
                                    key={cIdx}
                                    className="bg-white p-3 rounded-lg border border-slate-200/80 flex flex-col justify-between hover:border-indigo-300 transition-colors shadow-2xs"
                                  >
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800">{contact.name}</span>
                                        {contact.linkedin_url && (
                                          <a
                                            href={contact.linkedin_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800"
                                            title="Ver perfil de LinkedIn"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-500 font-medium">{contact.role || "Cargo no especificado"}</p>
                                    </div>

                                    {/* Teléfono / WhatsApp verificado */}
                                    {contact.phone && (
                                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                        <div className="flex items-center space-x-1.5 text-slate-700 font-medium truncate">
                                          <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <a
                                            href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                                            className="hover:underline hover:text-emerald-700 truncate"
                                            title="Llamar directamente a PBX o celular"
                                          >
                                            {contact.phone}
                                          </a>
                                        </div>
                                        <div className="flex items-center space-x-1 shrink-0">
                                          {contact.phone.replace(/[^\d]/g, '').length >= 10 && (
                                            <a
                                              href={`https://wa.me/${contact.phone.replace(/[^\d]/g, '').startsWith('57') ? contact.phone.replace(/[^\d]/g, '') : `57${contact.phone.replace(/[^\d]/g, '')}`}?text=${encodeURIComponent(`Hola ${contact.name}, un gusto saludarte. Te contacto de INNOVAIT.`)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 font-bold inline-flex items-center"
                                              title="Abrir chat en WhatsApp"
                                            >
                                              WhatsApp
                                            </a>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (navigator?.clipboard) {
                                                navigator.clipboard.writeText(contact.phone);
                                                alert(`Teléfono copiado: ${contact.phone}`);
                                              }
                                            }}
                                            className="text-slate-400 hover:text-slate-700 p-0.5"
                                            title="Copiar teléfono"
                                          >
                                            <Copy className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Correo Electrónico verificado */}
                                    {contact.email ? (
                                      <div className={`pt-1.5 flex items-center justify-between text-[11px] ${!contact.phone ? "mt-2 pt-2 border-t border-slate-100" : ""}`}>
                                        <div className="flex items-center space-x-1.5 text-indigo-700 truncate">
                                          <Mail className="w-3 h-3 text-purple-600 shrink-0" />
                                          <a
                                            href={`mailto:${contact.email}?subject=${encodeURIComponent("Propuesta de Eficiencia Operativa - INNOVAIT")}`}
                                            className="font-mono text-[10px] hover:underline truncate"
                                            title="Enviar correo"
                                          >
                                            {contact.email}
                                          </a>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (navigator?.clipboard) {
                                              navigator.clipboard.writeText(contact.email);
                                              alert(`Correo copiado: ${contact.email}`);
                                            }
                                          }}
                                          className="text-slate-400 hover:text-slate-700 ml-1 p-0.5"
                                          title="Copiar correo"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-amber-700 bg-amber-50/60 px-2 py-1 rounded">
                                        <span>Sin correo nominal directo (Validar vía PBX o LinkedIn)</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 3. SECCIÓN: RELACIÓN ENTRE DOLORES DETECTADOS Y SOLUCIÓN TÉCNICA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Dolores Detectados */}
                              <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-200/70">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Target className="w-4 h-4 text-rose-600" />
                                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                                    Dolores Críticos Detectados en el Prospecto
                                  </h4>
                                </div>
                                <ul className="space-y-1.5 text-xs text-rose-950">
                                  {(gate.context_details?.pain_points && gate.context_details.pain_points.length > 0
                                    ? gate.context_details.pain_points
                                    : [
                                        "Archivo físico en bodega con acumulación masiva de pagarés y expedientes en papel",
                                        "Duplicidad e inconsistencia de registros de asociados/clientes en base de datos",
                                        "Servidores locales antiguos on-premise sin respaldo cloud ante contingencias o pérdida de datos"
                                      ]
                                  ).map((pain, pIdx) => (
                                    <li key={pIdx} className="flex items-start space-x-1.5">
                                      <span className="text-rose-600 font-bold">•</span>
                                      <span>{pain}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Mapeo a la Solución Propuesta */}
                              <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/70">
                                <div className="flex items-center space-x-2 mb-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                                    Requerimientos y Módulos de Solución Asignados
                                  </h4>
                                </div>
                                <ul className="space-y-1.5 text-xs text-emerald-950">
                                  {(gate.context_details?.technical_requirements && gate.context_details.technical_requirements.length > 0
                                    ? gate.context_details.technical_requirements
                                    : [
                                        "Digitalización y extracción de metadatos OCR con IA integrada a validación CUFE/XML",
                                        "Limpieza algorítmica y deduplicación de ~300k registros antes de migración",
                                        "Despliegue contenerizado en AWS (ECS + RDS PostgreSQL cifrado) con respaldos automáticos"
                                      ]
                                  ).map((req, rIdx) => (
                                    <li key={rIdx} className="flex items-start space-x-1.5">
                                      <span className="text-emerald-600 font-bold">✓</span>
                                      <span>{req}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Barra de Acciones Humanas (HITL) */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs text-slate-400">
                        ID: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-600">{gate.opportunity_id}</code>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* Botón Agente de Voz Sara (Llamada IA disponible en Gate 1 y Gate 2) */}
                        {(gate.gate_type === "GATE_1_TARGET" || gate.gate_type === "GATE_2_OUTREACH") && (
                          <button
                            type="button"
                            onClick={() => handleOpenSaraModal(gate)}
                            className="px-3.5 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-sm hover:shadow-md transition-all flex items-center space-x-1.5 cursor-pointer border border-indigo-400/40"
                            title="Despachar llamada comercial con Sara (Voz IA con SIM Celular Android o Simulación con IA)"
                          >
                            <PhoneCall className="w-3.5 h-3.5 text-amber-300" />
                            <span>Llamar con Sara (Voz IA)</span>
                          </button>
                        )}

                        {gate.gate_type === "GATE_2_OUTREACH" && (
                          <>
                            {/* Acciones directas 1-clic con contactos reales */}
                            {gate.context_details?.contacts?.[0]?.phone && (
                              <>
                                <a
                                  href={`https://wa.me/${gate.context_details.contacts[0].phone.replace(/[^\d]/g, '').startsWith('57') ? gate.context_details.contacts[0].phone.replace(/[^\d]/g, '') : `57${gate.context_details.contacts[0].phone.replace(/[^\d]/g, '')}`}?text=${encodeURIComponent(gate.context_details?.whatsapp_message || "Hola, un gusto saludarte. Te contacto de INNOVAIT.")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                                  title="Abrir chat en WhatsApp Web con mensaje comercial cargado"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>WhatsApp Web</span>
                                </a>

                                <a
                                  href={`tel:${gate.context_details.contacts[0].phone.replace(/[^\d+]/g, '')}`}
                                  className="px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                                  title="Llamar teléfono directo o PBX"
                                >
                                  <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Llamar PBX</span>
                                </a>
                              </>
                            )}

                            {gate.context_details?.contacts?.[0]?.email && (
                              <a
                                href={`mailto:${gate.context_details.contacts[0].email}?subject=${encodeURIComponent(gate.context_details?.subject || gate.key_metrics?.subject || "INNOVAIT | Transformación digital")}&body=${encodeURIComponent(gate.context_details?.body_markdown || gate.recommendation_summary || "")}`}
                                className="px-3 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                                title="Abrir en cliente de correo local (Outlook / Gmail)"
                              >
                                <Mail className="w-3.5 h-3.5 text-purple-600" />
                                <span>Redactar Correo</span>
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopyOutreach(gate)}
                              className="px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                            >
                              {copiedId === gate.opportunity_id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>
                                    {getOutreachTab(gate) === "whatsapp"
                                      ? "Copiar WhatsApp"
                                      : getOutreachTab(gate) === "call"
                                      ? "Copiar Guion"
                                      : "Copiar Correo"}
                                  </span>
                                </>
                              )}
                            </button>
                          </>
                        )}

                        {/* Botón de Devolución a Gate anterior (solo visible si no es Gate 1) */}
                        {gate.gate_type !== "GATE_1_TARGET" && (
                          <button
                            onClick={() => handleOpenRegressModal(gate)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-all flex items-center space-x-1.5 cursor-pointer"
                            title="Devolver este prospecto a una compuerta anterior (ej. rehacer llamada o recalificar BANT)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Devolver de Gate</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setModifyTarget(gate);
                            setModifyModalOpen(true);
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all flex items-center space-x-1.5"
                        >
                          <span>Editar / Retroalimentar (Modify)</span>
                        </button>

                        <button
                          onClick={() => handleDecision(gate.opportunity_id, "OVERRIDE")}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center space-x-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Tomar Control (Override)</span>
                        </button>

                        <button
                          onClick={() => {
                            if (gate.gate_type === "GATE_2_OUTREACH") {
                              handleOpenConfirmOutreach(gate);
                            } else {
                              handleDecision(gate.opportunity_id, "APPROVE");
                            }
                          }}
                          className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center space-x-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{gate.gate_type === "GATE_2_OUTREACH" ? "Confirmar Envío (Approve)" : "Aprobar (Approve)"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PIPELINE KANBAN */}
        {activeTab === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
            {["1. Prospección (Gate 1)", "2. Outreach (Gate 2)", "3. Descubrimiento (Gate 3)", "4. Solución & Pricing (Gate 4)", "5. Cierre & Firma (Gate 5)"].map((column, idx) => (
              <div key={idx} className="bg-slate-100/70 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[450px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{column}</h4>
                </div>
                <div className="space-y-3 flex-1">
                  {pendingGates.filter(g => {
                    if (idx === 0) return g.gate_type === "GATE_1_TARGET";
                    if (idx === 1) return g.gate_type === "GATE_2_OUTREACH";
                    if (idx === 2) return g.gate_type === "GATE_3_DISCOVERY";
                    if (idx === 3) return g.gate_type === "GATE_4_ARCHITECT";
                    if (idx === 4) return g.gate_type === "GATE_5_LEGAL";
                    return false;
                  }).map(item => (
                    <div key={item.opportunity_id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 transition-all">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800">{item.company_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{item.recommendation_summary}</p>
                      <button
                        onClick={() => {
                          setActiveTab("inbox");
                        }}
                        className="mt-3 w-full py-1.5 text-center text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                      >
                        Revisar en Inbox →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: SERVICES CATALOG */}
        {activeTab === "catalog" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-6 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                      ⭐ Insignia
                    </span>
                    <button
                      onClick={() => handleOpenEditCatalog("DOC_MANAGER")}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-sm transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar Servicio y Tarifas</span>
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900">DocumentTrack</h3>
                <p className="text-sm text-slate-600 mt-2">
                  {serviceDescriptions.DOC_MANAGER}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.doc_starter}:</span>
                    <span className="font-bold text-slate-900">${customPrices.doc_starter_monthly} USD/mes + ${customPrices.doc_starter_impl.toLocaleString()} impl</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.doc_enterprise}:</span>
                    <span className="font-bold text-slate-900">${customPrices.doc_enterprise_monthly.toLocaleString()} USD/mes + ${customPrices.doc_enterprise_impl.toLocaleString()} impl</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.doc_custom}:</span>
                    <span className="font-bold text-slate-900">${customPrices.doc_custom_monthly.toLocaleString()} USD/mes + ${customPrices.doc_custom_impl.toLocaleString()} impl</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Database className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => handleOpenEditCatalog("DATA_HYGIENE")}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 shadow-sm transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Servicio y Tarifas</span>
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-900">Orden y Depuración de Bases de Datos</h3>
                <p className="text-sm text-slate-600 mt-2">
                  {serviceDescriptions.DATA_HYGIENE}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.data_audit}:</span>
                    <span className="font-bold text-slate-900">${customPrices.data_audit.toLocaleString()} USD fijo</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.data_standard}:</span>
                    <span className="font-bold text-slate-900">${customPrices.data_standard.toLocaleString()} USD fijo</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.data_enterprise}:</span>
                    <span className="font-bold text-slate-900">${customPrices.data_enterprise.toLocaleString()} USD fijo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => handleOpenEditCatalog("CLOUD_INFRA")}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 shadow-sm transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Servicio y Tarifas</span>
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-900">Infraestructuras Cloud (AWS / Azure / GCP)</h3>
                <p className="text-sm text-slate-600 mt-2">
                  {serviceDescriptions.CLOUD_INFRA}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.cloud_setup}:</span>
                    <span className="font-bold text-slate-900">${customPrices.cloud_setup.toLocaleString()} USD fijo</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.cloud_managed}:</span>
                    <span className="font-bold text-slate-900">${customPrices.cloud_managed.toLocaleString()} USD/mes</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.cloud_devops}:</span>
                    <span className="font-bold text-slate-900">${customPrices.cloud_devops.toLocaleString()} USD/mes</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => handleOpenEditCatalog("AI_AUTOMATION")}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 shadow-sm transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Servicio y Tarifas</span>
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-900">Automatización con IA & Agentes</h3>
                <p className="text-sm text-slate-600 mt-2">
                  {serviceDescriptions.AI_AUTOMATION}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.ai_poc}:</span>
                    <span className="font-bold text-slate-900">${customPrices.ai_poc.toLocaleString()} USD fijo</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.ai_agentic}:</span>
                    <span className="font-bold text-slate-900">${customPrices.ai_agentic.toLocaleString()} USD fijo</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{tierLabels.ai_enterprise}:</span>
                    <span className="font-bold text-slate-900">${customPrices.ai_enterprise.toLocaleString()} USD fijo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: DEVOLVER PROSPECTO A COMPUERTA PREVIA (REGRESS / ROLLBACK) */}
      {regressModalOpen && regressTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Devolver Prospecto a Compuerta Anterior
                </h3>
                <p className="text-xs text-slate-500">
                  {regressTarget.company_name} • Actualmente en: <span className="font-semibold text-slate-800">{regressTarget.gate_type}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleRegressGateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Selecciona la compuerta de destino:
                </label>
                <select
                  value={regressTargetGate}
                  onChange={(e) => setRegressTargetGate(e.target.value)}
                  className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none cursor-pointer"
                  required
                >
                  {getAvailablePreviousGates(regressTarget.gate_type).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  El prospecto retrocederá de inmediato a esta fase para que los agentes o humanos repitan el paso.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Motivo comercial o técnico de la devolución:
                </label>
                <textarea
                  value={regressReason}
                  onChange={(e) => setRegressReason(e.target.value)}
                  placeholder="Ej: El cliente solicitó nueva llamada telefónica con Sara para validar cambio de director de operaciones, o se ajustaron los requerimientos y toca recalificar BANT."
                  rows={3}
                  required
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-violet-50 border border-violet-100 rounded-2xl text-[11px] text-violet-900 flex items-start space-x-2">
                <Info className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                <span>
                  Esta acción quedará registrada en el historial de auditoría inmutable de la oportunidad para total trazabilidad del equipo comercial.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setRegressModalOpen(false);
                    setRegressTarget(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={regressingGate || !regressReason.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {regressingGate ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Devolviendo...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirmar Retroceso de Gate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR / RETROALIMENTAR (MODIFY) */}
      {modifyModalOpen && modifyTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">
              Instrucciones Humanas de Modificación (Gate Feedback)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Oportunidad: <span className="font-bold text-slate-700">{modifyTarget.company_name}</span> ({modifyTarget.gate_type})
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Retroalimentación para el Agente (Feedback):
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Ej: Modifica el tono del correo para enfatizar la depuración de base de datos antes de la gestión documental, o reduce el fee de implementación un 10% condicionado a contrato anual."
                  rows={4}
                  className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {modifyTarget.gate_type === "GATE_4_ARCHITECT" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Ajuste Manual de Descuento (%):
                  </label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="Ej: 15"
                    className="w-full text-sm p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={() => setModifyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const mods = discountValue ? { discount_percentage: parseFloat(discountValue) } : null;
                  handleDecision(modifyTarget.opportunity_id, "MODIFY", feedbackText, mods);
                }}
                disabled={!feedbackText.trim() || submitting}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? "Re-ejecutando Agente..." : "Re-ejecutar con Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ENVÍO / CONTACTO EN GATE 2 */}
      {confirmOutreachModalOpen && outreachConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  outreachChannel === "whatsapp"
                    ? "bg-emerald-50 text-emerald-700"
                    : outreachChannel === "phone"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-purple-50 text-purple-700"
                }`}>
                  {outreachChannel === "whatsapp" ? (
                    <MessageSquare className="w-5 h-5" />
                  ) : outreachChannel === "phone" ? (
                    <Phone className="w-5 h-5" />
                  ) : (
                    <Mail className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {outreachChannel === "whatsapp"
                      ? "Confirmar Envío por WhatsApp (Gate 2: Primer Contacto)"
                      : outreachChannel === "phone"
                      ? "Registrar Llamada Telefónica (Gate 2: Primer Contacto)"
                      : "Confirmar Envío de Correo (Gate 2: Primer Contacto)"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Empresa: <span className="font-bold text-slate-700">{outreachConfirmTarget.company_name}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setConfirmOutreachModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Selector de Canal en el Modal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Canal Utilizado para el Contacto:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChannelSwitchInModal("whatsapp")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      outreachChannel === "whatsapp"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChannelSwitchInModal("phone")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      outreachChannel === "phone"
                        ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Llamada PBX / Móvil</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChannelSwitchInModal("email")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      outreachChannel === "email"
                        ? "border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-200"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-purple-600" />
                    <span>Correo Outlook</span>
                  </button>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2 ${
                outreachChannel === "whatsapp"
                  ? "bg-emerald-50/70 border-emerald-100 text-emerald-950"
                  : outreachChannel === "phone"
                  ? "bg-blue-50/70 border-blue-100 text-blue-950"
                  : "bg-purple-50/70 border-purple-100 text-purple-950"
              }`}>
                <Info className={`w-4 h-4 mt-0.5 shrink-0 ${
                  outreachChannel === "whatsapp"
                    ? "text-emerald-700"
                    : outreachChannel === "phone"
                    ? "text-blue-700"
                    : "text-purple-700"
                }`} />
                <p>
                  {outreachChannel === "whatsapp"
                    ? "Confirma el envío del mensaje directo vía WhatsApp. Si realizaste adaptaciones, puedes ajustarlas abajo para que los agentes posteriores conozcan la conversación exacta."
                    : outreachChannel === "phone"
                    ? "Registra los puntos clave conversados en la llamada telefónica con el tomador de decisión o recepción para alimentar la etapa de Discovery."
                    : "Confirma el envío de correo desde tu cliente de Outlook. Los siguientes agentes (Discovery y Solución) usarán esta información para preparar la propuesta."}
                </p>
              </div>

              {/* Destinatario y Fecha */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {outreachChannel === "whatsapp"
                      ? "Celular / WhatsApp Contactado:"
                      : outreachChannel === "phone"
                      ? "Número Telefónico / PBX:"
                      : "Destinatario Principal (Email):"}
                  </label>
                  <input
                    type="text"
                    value={finalRecipient}
                    onChange={(e) => setFinalRecipient(e.target.value)}
                    placeholder={outreachChannel === "email" ? "contacto@empresa.com" : "+57 300 123 4567"}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Marca de Tiempo del Contacto:
                  </label>
                  <div className="text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 flex items-center space-x-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Se registrará la fecha y hora actual automáticamente</span>
                  </div>
                </div>
              </div>

              {/* Asunto o Título del Contacto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {outreachChannel === "email" ? "Línea de Asunto Enviada:" : "Referencia / Título de la Gestión:"}
                </label>
                <input
                  type="text"
                  required
                  value={finalSubject}
                  onChange={(e) => setFinalSubject(e.target.value)}
                  placeholder="Referencia del contacto..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Mensaje o Contenido Final */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    {outreachChannel === "whatsapp"
                      ? "Mensaje Enviado por WhatsApp:"
                      : outreachChannel === "phone"
                      ? "Notas de la Llamada / Resumen Conversado:"
                      : "Cuerpo del Correo Enviado (Texto Final Real):"}
                  </label>
                  <span className="text-[11px] text-slate-400">Editable / Puedes ajustar los detalles</span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={finalBody}
                  onChange={(e) => setFinalBody(e.target.value)}
                  placeholder="Detalles del mensaje o conversación sostenida..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl font-mono leading-relaxed text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between">
              <div>
                {outreachChannel === "whatsapp" && (
                  <button
                    type="button"
                    onClick={() => {
                      const cleanPhone = finalRecipient.replace(/[^\d]/g, '');
                      const waNum = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
                      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(finalBody)}`, "_blank");
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Abrir en WhatsApp Web</span>
                  </button>
                )}
                {outreachChannel === "email" && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `mailto:${encodeURIComponent(finalRecipient)}?subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalBody)}`;
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-purple-600" />
                    <span>Abrir en Outlook / Mail</span>
                  </button>
                )}
                {outreachChannel === "phone" && (
                  <a
                    href={`tel:${finalRecipient.replace(/[^\d+]/g, '')}`}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                    <span>Llamar al PBX</span>
                  </a>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setConfirmOutreachModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting || !finalBody.trim()}
                  onClick={async () => {
                    setConfirmOutreachModalOpen(false);
                    await handleDecision(outreachConfirmTarget.opportunity_id, "APPROVE", null, {
                      final_subject: finalSubject.trim() || `Contacto vía ${outreachChannel.toUpperCase()}`,
                      final_body: finalBody.trim(),
                      channel: outreachChannel.toUpperCase(),
                      recipient: finalRecipient.trim(),
                      sent_at: new Date().toISOString()
                    });
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Gestión y Avanzar a Gate 3 (Discovery)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR / CONSIGNAR CONTACTOS DE LA OPORTUNIDAD */}
      {editContactsModalOpen && editContactsTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Editar / Consignar Contactos
                  </h3>
                  <p className="text-xs text-slate-500">
                    Empresa: <strong className="text-slate-800">{editContactsTarget.company_name}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditContactsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Lista editable de contactos */}
            <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-950 flex items-start space-x-2">
                <Info className="w-4 h-4 text-indigo-700 mt-0.5 shrink-0" />
                <p>
                  Ingresa o actualiza el correo electrónico verificado, teléfono/WhatsApp o cargo del tomador de decisión. Los cambios quedarán consignados permanentemente en la base de datos y se usarán en las etapas de contacto y propuesta.
                </p>
              </div>

              {editingContactsList.map((contact, idx) => (
                <div key={idx} className="p-4 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Contacto #{idx + 1} {idx === 0 && <span className="text-indigo-600 font-extrabold">(Principal)</span>}
                    </span>
                    {editingContactsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContactRow(idx)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Nombre Completo:
                      </label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => handleContactFieldChange(idx, "name", e.target.value)}
                        placeholder="Ej: Javier Andrés Loaiza"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Cargo / Rol:
                      </label>
                      <input
                        type="text"
                        value={contact.role}
                        onChange={(e) => handleContactFieldChange(idx, "role", e.target.value)}
                        placeholder="Ej: Gerente de Tecnología / Dueño"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Correo Electrónico (Email):
                      </label>
                      <input
                        type="email"
                        value={contact.email || ""}
                        onChange={(e) => handleContactFieldChange(idx, "email", e.target.value)}
                        placeholder="ejemplo@empresa.com"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Teléfono / Móvil / WhatsApp:
                      </label>
                      <input
                        type="text"
                        value={contact.phone || ""}
                        onChange={(e) => handleContactFieldChange(idx, "phone", e.target.value)}
                        placeholder="+57 300 123 4567"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Enlace de LinkedIn (Opcional):
                    </label>
                    <input
                      type="url"
                      value={contact.linkedin_url || ""}
                      onChange={(e) => handleContactFieldChange(idx, "linkedin_url", e.target.value)}
                      placeholder="https://www.linkedin.com/in/usuario"
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddContactRow}
                className="w-full py-2 border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-700 hover:bg-indigo-50/50 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Otro Contacto a esta Empresa</span>
              </button>
            </div>

            {/* Footer de Acciones */}
            <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={savingContacts}
                onClick={() => setEditContactsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingContacts}
                onClick={handleSaveContacts}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {savingContacts ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Guardando Datos...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar y Consignar Contacto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RADAR DE PROSPECCIÓN AUTÓNOMA (LEAD HUNTER AGENT) */}
      {radarModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Compass className={`w-6 h-6 ${radarScanning ? "animate-spin" : ""}`} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <span>Radar de Prospección Autónoma B2B</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                      Lead Hunter Agent
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Búsqueda y pre-calificación inteligente de empresas reales colombianas con alto potencial
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!radarScanning) setRadarModalOpen(false);
                }}
                disabled={radarScanning}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Si hay resultado exitoso del escaneo */}
              {radarResult ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">
                        ¡Escaneo completado! {radarResult.discovered_count} nuevos prospectos calificados
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        {radarResult.message}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Prospectos Descubiertos e Integrados a Gate 1:
                    </span>
                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
                      {radarResult.opportunities?.map((opp, idx) => (
                        <div
                          key={opp.opportunity_id || idx}
                          className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 text-xs flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{opp.company_name}</span>
                              {opp.website ? (
                                <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.2 rounded border border-blue-100">
                                  Corporativa
                                </span>
                              ) : (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.2 rounded border border-emerald-100">
                                  🟢 PyME (PBX/WhatsApp)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {opp.icp_data?.industry || opp.sector || "Sector B2B"} • {opp.country || "Colombia"}
                              {opp.address && ` • 📍 ${opp.address}`}
                            </p>
                            {opp.contacts && opp.contacts.length > 0 && (
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-700">
                                <span><strong>👤 {opp.contacts[0].name}</strong> ({opp.contacts[0].role || "Líder"})</span>
                                {opp.contacts[0].phone && <span className="text-emerald-700 font-bold">📞 {opp.contacts[0].phone}</span>}
                                {opp.contacts[0].email && <span className="text-indigo-700 font-mono">✉️ {opp.contacts[0].email}</span>}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                            Pausado en Gate 1
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Selector de Sector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      1. Sector Industrial Objetivo:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {radarSectorList.map((sec) => (
                        <div
                          key={sec.id}
                          onClick={() => setRadarSector(sec.name)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            radarSector === sec.name
                              ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-300 shadow-2xs"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center space-x-2 font-bold text-slate-900">
                            <span className="text-base">{sec.icon}</span>
                            <span>{sec.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                            {sec.pain}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ciudad y Perfil */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        2. Ciudad o Región Geográfica:
                      </label>
                      <select
                        value={radarCity}
                        onChange={(e) => setRadarCity(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        {radarCityList.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        3. Perfil de Empresa:
                      </label>
                      <select
                        value={radarCompanyType}
                        onChange={(e) => setRadarCompanyType(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="all">🌐 Todos los tipos (PyMEs y Corporativas)</option>
                        <option value="sme">🟢 PyMEs Tradicionales (Sin web / PBX & WhatsApp)</option>
                        <option value="corporate">🏢 Medianas y Grandes (Con sitio web & TI)</option>
                      </select>
                    </div>
                  </div>

                  {/* Cantidad de Prospectos */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      4. Cantidad de Prospectos a Descubrir:
                    </label>
                    <div className="flex items-center space-x-2">
                      {[3, 5, 8, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setRadarLimit(num)}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            radarLimit === num
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
                          }`}
                        >
                          {num} Prospectos
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cuadro de Garantía de Calidad */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start space-x-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p className="leading-relaxed">
                      El <strong>Lead Hunter Agent</strong> consultará fuentes de datos empresariales reales (directorios de Cámaras de Comercio, RUES y Apollo), <strong>descartará duplicados</strong> que ya tengas registrados, calculará el encaje con INNOVAIT y depositará automáticamente los prospectos en el <strong>Gate 1</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer de Acciones */}
            <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
              {radarResult ? (
                <button
                  type="button"
                  onClick={() => {
                    setRadarModalOpen(false);
                    setActiveTab("inbox");
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Inbox className="w-4 h-4" />
                  <span>Ir a Bandeja de Entrada (Ver Gate 1)</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={radarScanning}
                    onClick={() => setRadarModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={radarScanning}
                    onClick={handleRunRadar}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {radarScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Escaneando Fuentes Comerciales...</span>
                      </>
                    ) : (
                      <>
                        <Compass className="w-4 h-4 text-emerald-100" />
                        <span>Activar Radar ({radarLimit} Prospectos)</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA OPORTUNIDAD */}
      {newOppModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Agregar Nuevo Prospecto B2B</h3>
            <p className="text-xs text-slate-500 mt-1">
              Dispara el Scraper & Enricher Agent con enriquecimiento vía Apollo.io y Hunter.io.
            </p>

            <form onSubmit={handleCreateOpportunity} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre de la Empresa:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Logística Transcontinental S.A."
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sitio Web / Dominio:</label>
                <input
                  type="text"
                  placeholder="Ej: https://www.logisticatrans.com"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">País:</label>
                <input
                  type="text"
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewOppModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Iniciando Agente..." : "Iniciar Prospección"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MODIFICAR SERVICIO Y PRECIOS DEL CATÁLOGO */}
      {editCatalogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-2 mb-1">
              <Pencil className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900">
                {editingServiceId === "DOC_MANAGER" && "Editar Servicio: DocumentTrack"}
                {editingServiceId === "DATA_HYGIENE" && "Editar Servicio: Orden y Depuración de BD"}
                {editingServiceId === "CLOUD_INFRA" && "Editar Servicio: Infraestructuras Cloud"}
                {editingServiceId === "AI_AUTOMATION" && "Editar Servicio: Automatización con IA & Agentes"}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Los cambios se guardan de inmediato en el catálogo oficial y actualizan la lógica de cotización de los agentes.
            </p>

            {/* Campo editable de Descripción del Servicio */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Descripción Oficial del Servicio:
              </label>
              <textarea
                rows={3}
                value={currentEditingSummary}
                onChange={(e) => setCurrentEditingSummary(e.target.value)}
                placeholder="Descripción del servicio para la propuesta y el catálogo..."
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800"
              />
            </div>

            {/* Formulario según el servicio seleccionado */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {editingServiceId === "DOC_MANAGER" && (
                <>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="mb-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Capacidad del Tier:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.doc_starter}
                        onChange={(e) => setTierLabels({ ...tierLabels, doc_starter: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Tier Starter (15 usuarios)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mensualidad (USD):</label>
                        <input
                          type="number"
                          value={customPrices.doc_starter_monthly}
                          onChange={(e) => setCustomPrices({ ...customPrices, doc_starter_monthly: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Implementación (USD):</label>
                        <input
                          type="number"
                          value={customPrices.doc_starter_impl}
                          onChange={(e) => setCustomPrices({ ...customPrices, doc_starter_impl: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="mb-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Capacidad del Tier:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.doc_enterprise}
                        onChange={(e) => setTierLabels({ ...tierLabels, doc_enterprise: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Tier Enterprise (100 usuarios)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mensualidad (USD):</label>
                        <input
                          type="number"
                          value={customPrices.doc_enterprise_monthly}
                          onChange={(e) => setCustomPrices({ ...customPrices, doc_enterprise_monthly: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Implementación (USD):</label>
                        <input
                          type="number"
                          value={customPrices.doc_enterprise_impl}
                          onChange={(e) => setCustomPrices({ ...customPrices, doc_enterprise_impl: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="mb-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Capacidad del Tier:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.doc_custom}
                        onChange={(e) => setTierLabels({ ...tierLabels, doc_custom: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Tier Corporate Custom (500+ usuarios)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mensualidad (USD):</label>
                        <input
                          type="number"
                          value={customPrices.doc_custom_monthly}
                          onChange={(e) => setCustomPrices({ ...customPrices, doc_custom_monthly: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Implementación (USD):</label>
                        <input
                          type="number"
                          value={customPrices.doc_custom_impl}
                          onChange={(e) => setCustomPrices({ ...customPrices, doc_custom_impl: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {editingServiceId === "DATA_HYGIENE" && (
                <>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.data_audit}
                        onChange={(e) => setTierLabels({ ...tierLabels, data_audit: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Auditoría & Plan (2 semanas)"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Fija (USD):</label>
                      <input
                        type="number"
                        value={customPrices.data_audit}
                        onChange={(e) => setCustomPrices({ ...customPrices, data_audit: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.data_standard}
                        onChange={(e) => setTierLabels({ ...tierLabels, data_standard: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Depuración Standard (hasta 500k registros)"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Fija (USD):</label>
                      <input
                        type="number"
                        value={customPrices.data_standard}
                        onChange={(e) => setCustomPrices({ ...customPrices, data_standard: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.data_enterprise}
                        onChange={(e) => setTierLabels({ ...tierLabels, data_enterprise: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Migración Enterprise & Refactorización"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Fija (USD):</label>
                      <input
                        type="number"
                        value={customPrices.data_enterprise}
                        onChange={(e) => setCustomPrices({ ...customPrices, data_enterprise: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingServiceId === "CLOUD_INFRA" && (
                <>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.cloud_setup}
                        onChange={(e) => setTierLabels({ ...tierLabels, cloud_setup: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Assessment & Setup Inicial"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Fija (USD):</label>
                      <input
                        type="number"
                        value={customPrices.cloud_setup}
                        onChange={(e) => setCustomPrices({ ...customPrices, cloud_setup: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.cloud_managed}
                        onChange={(e) => setTierLabels({ ...tierLabels, cloud_managed: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Managed Cloud Support"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Mensual (USD):</label>
                      <input
                        type="number"
                        value={customPrices.cloud_managed}
                        onChange={(e) => setCustomPrices({ ...customPrices, cloud_managed: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.cloud_devops}
                        onChange={(e) => setTierLabels({ ...tierLabels, cloud_devops: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="DevOps & SRE Enterprise 24/7"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Mensual (USD):</label>
                      <input
                        type="number"
                        value={customPrices.cloud_devops}
                        onChange={(e) => setCustomPrices({ ...customPrices, cloud_devops: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingServiceId === "AI_AUTOMATION" && (
                <>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.ai_poc}
                        onChange={(e) => setTierLabels({ ...tierLabels, ai_poc: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="PoC Fast Track (2 semanas)"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Fija (USD):</label>
                      <input
                        type="number"
                        value={customPrices.ai_poc}
                        onChange={(e) => setCustomPrices({ ...customPrices, ai_poc: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.ai_agentic}
                        onChange={(e) => setTierLabels({ ...tierLabels, ai_agentic: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Sistema Agéntico Productivo (6 semanas)"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Fija (USD):</label>
                      <input
                        type="number"
                        value={customPrices.ai_agentic}
                        onChange={(e) => setCustomPrices({ ...customPrices, ai_agentic: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nombre / Alcance del Nivel:
                      </label>
                      <input
                        type="text"
                        value={tierLabels.ai_enterprise}
                        onChange={(e) => setTierLabels({ ...tierLabels, ai_enterprise: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-medium text-slate-800 bg-white"
                        placeholder="Ecosistema Multi-Agente Enterprise"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tarifa Fija (USD):</label>
                      <input
                        type="number"
                        value={customPrices.ai_enterprise}
                        onChange={(e) => setCustomPrices({ ...customPrices, ai_enterprise: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditCatalogModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePrices}
                disabled={pricesSaving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{pricesSaving ? "Guardando..." : "Guardar Cambios"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ARCHIVO MAESTRO SERVICES_CATALOG.JSON */}
      {masterCatalogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Archivo Maestro de Soluciones y Tarifas Base
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    backend/app/knowledge/services_catalog.json
                  </p>
                </div>
              </div>

              <button
                onClick={() => setMasterCatalogModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3">
              Este archivo JSON maestro es la <strong>fuente única de verdad</strong> de donde los agentes consultan módulos técnicos, alcances y calculan las tarifas de cotización (Gate 4 Arquitectura & Pricing).
            </p>

            {/* Selector de Vistas */}
            <div className="flex items-center space-x-2 mt-3 mb-2 border-b border-slate-200">
              <button
                onClick={() => setActiveCatalogModalTab("structured")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all ${
                  activeCatalogModalTab === "structured"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Vista de Módulos & Tarifas
              </button>
              <button
                onClick={() => setActiveCatalogModalTab("json")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all ${
                  activeCatalogModalTab === "json"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Código JSON Maestro (Crudo)
              </button>
            </div>

            {/* Contenido según Tab */}
            <div className="flex-1 overflow-y-auto my-2 pr-1">
              {activeCatalogModalTab === "structured" ? (
                <div className="space-y-3">
                  {catalog?.services && catalog.services.length > 0 ? (
                    catalog.services.map((srv) => (
                      <div key={srv.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900">{srv.name}</span>
                          <code className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">{srv.id}</code>
                        </div>
                        <p className="text-xs text-slate-600 mb-2">{srv.summary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                          {srv.pricing_tiers && Object.entries(srv.pricing_tiers).map(([tierKey, tierVal]) => (
                            <div key={tierKey} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
                              <span className="font-semibold text-slate-800 block text-[11px]">{tierVal.name || tierKey}</span>
                              <div className="text-[11px] text-blue-700 font-bold mt-1">
                                {tierVal.fixed_fee_usd && `Fijo: $${tierVal.fixed_fee_usd.toLocaleString()} USD`}
                                {tierVal.monthly_fee_usd && `Mensual: $${tierVal.monthly_fee_usd.toLocaleString()} USD`}
                                {tierVal.implementation_fee_usd && ` (Impl: $${tierVal.implementation_fee_usd.toLocaleString()})`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                      Cargando estructura del catálogo maestro...
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-auto max-h-[50vh] leading-relaxed">
                    {JSON.stringify(catalog, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  if (navigator?.clipboard) {
                    navigator.clipboard.writeText(JSON.stringify(catalog, null, 2));
                    setCatalogJsonCopied(true);
                    setTimeout(() => setCatalogJsonCopied(false), 2000);
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                {catalogJsonCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">¡Copiado al Portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar JSON Completo</span>
                  </>
                )}
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setMasterCatalogModalOpen(false);
                    setActiveTab("catalog");
                  }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Modificar Tarifas en Pestaña Catálogo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGENTE DE VOZ SARA (LLAMADAS B2B CELULAR SIM + GEMINI LIVE) */}
      {saraModalOpen && saraTargetGate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header del Modal con Gradiente */}
            <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-800 p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
                  <PhoneCall className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black tracking-tight">Agente de Llamadas B2B Sara</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-emerald-950 uppercase tracking-wider">
                      Voz IA Celular SIM
                    </span>
                  </div>
                  <p className="text-xs text-indigo-100 mt-0.5">
                    INNOVAIT Transformación Digital • Gemini Live Multimodal • Línea Móvil Colombiana Dedicada
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  stopAudioPlayback();
                  setSaraModalOpen(false);
                }}
                className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Barra de Configuración Rápida del Destinatario */}
            <div className="bg-indigo-50/70 border-b border-indigo-100 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Empresa Destino:</label>
                <div className="p-2 bg-white rounded-xl border border-indigo-200 font-bold text-indigo-900 truncate">
                  {saraTargetGate.company_name}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Contacto / Cargo:</label>
                <input
                  type="text"
                  value={saraContactName}
                  onChange={(e) => setSaraContactName(e.target.value)}
                  placeholder="Nombre del interlocutor"
                  className="w-full p-2 bg-white rounded-xl border border-indigo-200 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Teléfono a Marcar (🇨🇴):</label>
                <input
                  type="text"
                  value={saraPhone}
                  onChange={(e) => setSaraPhone(e.target.value)}
                  placeholder="+57 (604) 480 1000"
                  className="w-full p-2 bg-white rounded-xl border border-indigo-200 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">Voz de Sara:</label>
                  <button
                    type="button"
                    onClick={() => playVoicePreview(saraVoice)}
                    className="text-[10px] font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded border border-violet-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                    title="Reproducir muestra de la voz seleccionada"
                  >
                    <Volume2 className="w-3 h-3 text-violet-600" />
                    <span>Probar voz</span>
                  </button>
                </div>
                <select
                  value={saraVoice}
                  onChange={(e) => setSaraVoice(e.target.value)}
                  className="w-full p-2 bg-white rounded-xl border border-indigo-200 text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                >
                  <option value="paloma">🌎 Paloma (Femenina ejecutiva moderna - Latino neutro)</option>
                  <option value="dalia">🌎 Dalia (Femenina consultiva suave - Latino neutro)</option>
                  <option value="jorge">🌎 Jorge (Masculino formal consultivo - Latino neutro)</option>
                </select>
              </div>
            </div>

            {/* Pestañas de Navegación del Modal */}
            <div className="flex items-center space-x-1 px-5 pt-3 border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setSaraActiveSubTab("preview")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                  saraActiveSubTab === "preview"
                    ? "border-violet-600 text-violet-700 bg-white rounded-t-lg"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Guion & Contexto de Sara</span>
              </button>

              <button
                type="button"
                onClick={() => setSaraActiveSubTab("simulate")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                  saraActiveSubTab === "simulate"
                    ? "border-violet-600 text-violet-700 bg-white rounded-t-lg"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Simulación con IA (Gemini)</span>
                {saraSimulationResult && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSaraActiveSubTab("live")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                  saraActiveSubTab === "live"
                    ? "border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Mic className="w-3.5 h-3.5 text-emerald-600" />
                <span>🎙️ Hablar en Vivo (Micrófono)</span>
                {liveCallActive && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSaraActiveSubTab("dispatch")}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                  saraActiveSubTab === "dispatch"
                    ? "border-violet-600 text-violet-700 bg-white rounded-t-lg"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-blue-500" />
                <span>Celular Android (SIM Dedicada)</span>
                {saraDispatchedJob && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px]">En cola</span>
                )}
              </button>
            </div>

            {/* Contenido según Pestaña Activa */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* SUBTAB 1: GUION Y CONTEXTO */}
              {saraActiveSubTab === "preview" && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start space-x-3">
                    <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Reglas de Operación Telefónica de Sara:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 text-amber-800">
                        <li><strong>Transparencia obligatoria:</strong> Se identifica en la primera frase como asistente de IA de <em>INNOVAIT Transformación Digital</em>.</li>
                        <li><strong>Pitch conciso (30s):</strong> Resalta DocumentTrack (OCR, digitalización de archivo físico, reducción de costos de bodegaje y cumplimiento DIAN).</li>
                        <li><strong>Manejo de objeciones colombianas:</strong> Responde con empatía ante "¿quién le dio mi número?", "mándeme un correo" o "ya tenemos proveedor".</li>
                        <li><strong>Fusible de seguridad:</strong> Duración máxima de 3 minutos y corte automático si entra a buzón de voz.</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Instrucciones Adicionales o Contexto Específico (Opcional):
                    </label>
                    <input
                      type="text"
                      value={saraCustomInstructions}
                      onChange={(e) => setSaraCustomInstructions(e.target.value)}
                      placeholder="Ej: El cliente tuvo auditoría reciente de la Superintendencia / Preguntar por el jefe de compras..."
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                        <FileCode className="w-4 h-4 text-violet-600" />
                        <span>System Prompt Dinámico Inyectado en Gemini Live:</span>
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          setSaraLoadingPrompt(true);
                          try {
                            const res = await authFetch(`${API_BASE}/voice/prompt/${saraTargetGate.opportunity_id}?contact_name=${encodeURIComponent(saraContactName)}&contact_role=${encodeURIComponent(saraContactRole)}&custom_instructions=${encodeURIComponent(saraCustomInstructions)}`);
                            if (res.ok) {
                              const d = await res.json();
                              setSaraPrompt(d.system_prompt || "");
                            }
                          } finally {
                            setSaraLoadingPrompt(false);
                          }
                        }}
                        className="text-[11px] text-violet-700 hover:text-violet-900 font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${saraLoadingPrompt ? "animate-spin" : ""}`} />
                        <span>Regenerar Prompt</span>
                      </button>
                    </div>

                    <div className="relative">
                      {saraLoadingPrompt ? (
                        <div className="p-8 bg-slate-900 text-indigo-300 rounded-2xl text-xs font-mono text-center flex items-center justify-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generando prompt adaptado al prospecto...</span>
                        </div>
                      ) : (
                        <pre className="bg-slate-950 text-indigo-200 p-4 rounded-2xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[35vh] border border-slate-800 whitespace-pre-wrap">
                          {saraPrompt || "Cargando guion de Sara..."}
                        </pre>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleSimulateSaraCall}
                      disabled={saraSimulating}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>{saraSimulating ? "Simulando conversación..." : "Probar Simulación con IA"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUBTAB 2: SIMULACIÓN INTERACTIVA */}
              {saraActiveSubTab === "simulate" && (
                <div className="space-y-4">
                  {!saraSimulationResult && !saraSimulating && (
                    <div className="p-8 bg-violet-50/60 border border-violet-200 rounded-2xl text-center space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg">
                        <Sparkles className="w-7 h-7 text-amber-300" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900">Simulador de Conversación B2B</h4>
                      <p className="text-xs text-slate-600 max-w-lg mx-auto">
                        Ejecuta una llamada simulada en tiempo real con <strong>Gemini 2.5</strong> donde Sara llama al contacto de <strong>{saraTargetGate.company_name}</strong>, supera las objeciones típicas colombianas, propone la solución DocumentTrack y busca agendar la reunión de 15 minutos.
                      </p>
                      <button
                        type="button"
                        onClick={handleSimulateSaraCall}
                        className="px-6 py-3 rounded-2xl text-xs font-black text-white bg-violet-700 hover:bg-violet-800 shadow-md transition-all inline-flex items-center space-x-2 cursor-pointer"
                      >
                        <PhoneCall className="w-4 h-4 text-amber-300" />
                        <span>Iniciar Simulación de Llamada Ahora</span>
                      </button>
                    </div>
                  )}

                  {saraSimulating && (
                    <div className="p-10 bg-slate-900 text-white rounded-2xl text-center space-y-3 animate-pulse">
                      <div className="w-12 h-12 mx-auto rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center">
                        <Volume2 className="w-6 h-6 animate-bounce" />
                      </div>
                      <h4 className="text-sm font-bold text-violet-200">Sara está en llamada con {saraContactName}...</h4>
                      <p className="text-xs text-slate-400">
                        Evaluando respuestas, manejando objeciones de archivo físico y cerrando fecha de reunión...
                      </p>
                    </div>
                  )}

                  {saraSimulationResult && (
                    <div className="space-y-4">
                      {/* Resumen del Resultado */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase">Estado de Llamada</span>
                          <p className="text-sm font-black text-emerald-700 mt-0.5 flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                            {saraSimulationResult.status === "completed" ? "Completada (Éxito)" : saraSimulationResult.status}
                          </p>
                          <span className="text-[11px] text-emerald-600 font-mono">
                            Duración: {saraSimulationResult.duration_seconds || 115}s
                          </span>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-2xl">
                          <span className="text-[10px] font-bold text-indigo-800 uppercase">Reunión Agendada</span>
                          <p className="text-sm font-black text-indigo-900 mt-0.5">
                            {saraSimulationResult.meeting_scheduled ? "✅ SÍ AGENDADA" : "Pendiente"}
                          </p>
                          <span className="text-[11px] text-indigo-700 font-semibold truncate block">
                            {saraSimulationResult.meeting_datetime || "Jueves 10:00 AM (Virtual)"}
                          </span>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-2xl">
                          <span className="text-[10px] font-bold text-purple-800 uppercase">Correo Confirmado</span>
                          <p className="text-xs font-black text-purple-900 mt-1 truncate" title={saraSimulationResult.confirmed_email}>
                            {saraSimulationResult.confirmed_email || "Confirmado por interlocutor"}
                          </p>
                          <span className="text-[11px] text-purple-600">Para envío de enlace Meet</span>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl">
                          <span className="text-[10px] font-bold text-amber-800 uppercase">Objeciones Resueltas</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {saraSimulationResult.objections_handled && saraSimulationResult.objections_handled.length > 0 ? (
                              saraSimulationResult.objections_handled.map((obj, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-amber-200/80 text-amber-900 rounded text-[10px] font-bold">
                                  {obj}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-amber-800 font-medium">Interés directo</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Transcripción y Reproductor de Audio Sincronizado */}
                      {(() => {
                        const transcriptItems = parseTranscriptItems(saraSimulationResult.transcript);
                        return (
                          <div className="space-y-3">
                            {/* Barra de Reproductor de Audio de la Llamada */}
                            <div className="bg-gradient-to-r from-violet-950 via-indigo-950 to-slate-900 p-4 rounded-2xl border border-violet-800/60 shadow-lg flex items-center justify-between">
                              <div className="flex items-center space-x-3.5">
                                <button
                                  type="button"
                                  onClick={() => playTranscriptAudio(transcriptItems)}
                                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all shadow-md cursor-pointer ${
                                    isPlayingAudio
                                      ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
                                      : "bg-amber-400 hover:bg-amber-300 text-slate-950 hover:scale-105"
                                  }`}
                                  title={isPlayingAudio ? "Detener reproducción de audio" : "Escuchar la llamada en audio con la voz de Sara"}
                                >
                                  {isPlayingAudio ? (
                                    <Square className="w-5 h-5 fill-current" />
                                  ) : (
                                    <Play className="w-6 h-6 fill-current ml-0.5" />
                                  )}
                                </button>

                                <div>
                                  <div className="flex items-center space-x-2">
                                    <h5 className="text-sm font-bold text-white">
                                      {isPlayingAudio ? "Reproduciendo Llamada en Audio..." : "▶ Escuchar Simulación de Llamada"}
                                    </h5>
                                    {isPlayingAudio && (
                                      <span className="flex items-center text-amber-300 text-[11px] font-mono animate-pulse">
                                        <Volume2 className="w-3.5 h-3.5 mr-1" />
                                        Intervención {currentAudioIndex + 1} de {transcriptItems.length}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-indigo-200 mt-0.5 flex items-center space-x-1">
                                    <span>🎙️ <strong>Voz IA:</strong> Neuronal de Alta Fidelidad</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                {isPlayingAudio && (
                                  <button
                                    type="button"
                                    onClick={stopAudioPlayback}
                                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                                  >
                                    <VolumeX className="w-3.5 h-3.5 text-rose-300" />
                                    <span>Detener Audio</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between mb-1 px-1">
                              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                                <Headphones className="w-4 h-4 text-violet-600" />
                                <span>Transcripción y Audio Sincronizado:</span>
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {transcriptItems.length} intervenciones
                              </span>
                            </div>

                            <div className="bg-slate-900 rounded-2xl p-4 max-h-[36vh] overflow-y-auto space-y-3 border border-slate-800">
                              {transcriptItems.length > 0 ? (
                                transcriptItems.map((msg, idx) => {
                                  const isSara = (msg.speaker || "").toLowerCase().includes("sara") || (msg.speaker || "").toLowerCase().includes("maggie");
                                  const isCurrentlySpeaking = currentAudioIndex === idx;
                                  return (
                                    <div
                                      key={idx}
                                      className={`flex flex-col transition-all duration-300 ${isSara ? "items-end" : "items-start"}`}
                                    >
                                      <span className={`text-[10px] font-bold mb-0.5 px-1 flex items-center space-x-1 ${
                                        isCurrentlySpeaking ? "text-amber-300 font-black" : "text-slate-400"
                                      }`}>
                                        {isCurrentlySpeaking && <Volume2 className="w-3 h-3 text-amber-400 mr-1 animate-bounce" />}
                                        <span>{isSara ? "🎙️ Sara (IA INNOVAIT)" : `👤 ${msg.speaker || "Contacto"}`}</span>
                                      </span>
                                      <div
                                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed transition-all ${
                                          isCurrentlySpeaking
                                            ? "ring-2 ring-amber-400 shadow-xl scale-[1.01] " + (isSara ? "bg-violet-700 text-white font-medium" : "bg-slate-700 text-white font-medium")
                                            : isSara
                                            ? "bg-violet-600 text-white rounded-tr-none shadow-sm"
                                            : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700"
                                        }`}
                                      >
                                        {msg.text}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-xs text-slate-400 text-center py-4">No hay transcripción disponible.</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Botón de Aprobación y Avance a Gate 3 */}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <strong className="text-xs font-bold text-emerald-900 block">
                            ¿Aprobar resultado de la llamada?
                          </strong>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            Al confirmar, los datos se guardarán y la oportunidad avanzará automáticamente a <strong>Gate 3: Validación Alcance BANT</strong>.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveSaraToGate3}
                          disabled={saraSavingGate3}
                          className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{saraSavingGate3 ? "Avanzando oportunidad..." : "Aprobar y Avanzar a Gate 3"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB: HABLAR EN VIVO CON SARA (MICRÓFONO INTERACTIVO) */}
              {saraActiveSubTab === "live" && (
                <div className="space-y-4">
                  {/* Detección de Conexión HTTP Remota en AWS (Restricción de Seguridad del Navegador para el Micrófono) */}
                  {typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && (
                    <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100/70 border border-amber-300 rounded-2xl flex items-start space-x-3 text-amber-950 text-xs shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">
                        🔒
                      </div>
                      <div className="space-y-1">
                        <strong className="block text-amber-950 font-bold text-sm">
                          Restricción del Navegador: Conexión HTTP sin SSL en AWS
                        </strong>
                        <p className="text-amber-900 leading-relaxed">
                          Google Chrome y Edge <strong>bloquean la entrada del micrófono</strong> cuando una aplicación se abre en una IP remota por <code>http://</code> en lugar de <code>https://</code>. Por eso escuchas a Sara con nitidez, pero tu voz no sale del navegador.
                        </p>
                        <div className="mt-2 p-2.5 bg-amber-200/50 rounded-xl text-amber-950 space-y-1">
                          <p className="font-bold">💡 Para activar el micrófono en esta IP de prueba en 30 segundos:</p>
                          <p className="text-[11px] leading-relaxed">
                            1. Abre en otra pestaña de Chrome: <code className="bg-white/80 px-1 py-0.5 rounded font-mono select-all">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code><br/>
                            2. Agrega la URL de tu app en AWS: <code className="bg-white/80 px-1 py-0.5 rounded font-mono select-all">{typeof window !== "undefined" ? window.location.origin : "http://IP:3000"}</code><br/>
                            3. Cambia a <strong>Enabled</strong> y presiona <strong>Relaunch</strong> (Reiniciar).
                          </p>
                        </div>
                        <p className="text-amber-800 text-[11px] font-medium pt-0.5">
                          👉 O si prefieres probar de inmediato sin configurar el navegador, utiliza los <strong>Atajos rápidos</strong> o escribe en el <strong>campo de texto</strong> inferior.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Detección de Compatibilidad de Navegador (Firefox / Opera vs Chrome / Edge) */}
                  {typeof window !== "undefined" && !window.SpeechRecognition && !window.webkitSpeechRecognition && (
                    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl flex items-start space-x-3 text-amber-950 text-xs shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 font-bold">
                        ⚠️
                      </div>
                      <div>
                        <strong className="block text-amber-950 font-bold text-sm">
                          Navegador sin reconocimiento de voz por micrófono (Firefox / Opera)
                        </strong>
                        <p className="text-amber-800 mt-1 leading-relaxed">
                          <strong>Firefox</strong> y <strong>Opera</strong> tienen desactivada de fábrica la API de reconocimiento de voz (Web Speech API). Para que Sara te escuche directamente por el micrófono al hablarle, por favor abre la aplicación en <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>.
                        </p>
                        <p className="text-amber-900 font-semibold mt-1.5 flex items-center space-x-1">
                          <span>💡 En este navegador puedes interactuar con los botones de</span>
                          <span className="underline font-bold">"Atajos rápidos"</span>
                          <span>o el campo de texto.</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Banner Superior de Estado y Controles */}
                  <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-lg border border-emerald-800/40 flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                        liveCallActive
                          ? liveCallStatus === "speaking"
                            ? "bg-violet-600 text-white animate-pulse shadow-lg shadow-violet-500/50"
                            : liveCallStatus === "listening"
                            ? "bg-emerald-500 text-white animate-bounce shadow-lg shadow-emerald-500/50"
                            : "bg-amber-500 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {liveCallActive ? (
                          liveCallStatus === "speaking" ? (
                            <Volume2 className="w-6 h-6" />
                          ) : (
                            <Mic className="w-6 h-6" />
                          )
                        ) : (
                          <Phone className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold tracking-tight">
                            Llamada Interactiva en Vivo
                          </h4>
                          {liveCallActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/30 text-rose-300 border border-rose-500/50 flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
                              <span>EN LÍNEA</span>
                            </span>
                          )}
                          {liveCallMeetingScheduled && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-300 border border-emerald-500/50">
                              🎯 DEMO AGENDADA
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-xs text-slate-300 mt-0.5">
                          <span>
                            {liveCallInterlocutorLabel ? (
                              <span>Al teléfono: <strong className="text-emerald-400">{liveCallInterlocutorLabel}</strong> <span className="text-[10px] text-slate-400">({(saraContactName && !isGenericContact(saraContactName)) ? saraContactName : "Indagando contacto"})</span></span>
                            ) : (
                              <span>Contacto: <strong>{(saraContactName && !isGenericContact(saraContactName)) ? saraContactName : "Por indagar en la llamada"}</strong></span>
                            )}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            ⏱️ {Math.floor(liveCallSeconds / 60).toString().padStart(2, "0")}:{(liveCallSeconds % 60).toString().padStart(2, "0")}
                          </span>
                          <span>•</span>
                          <span className="text-[11px] text-slate-400">
                            {liveCallStatus === "speaking" && "🔴 Sara hablando..."}
                            {liveCallStatus === "listening" && "🟢 Sara te escucha (habla ahora)"}
                            {liveCallStatus === "thinking" && "🟡 Sara pensando..."}
                            {liveCallStatus === "idle" && (liveCallActive ? "⚪ En espera" : "Inactivo")}
                            {liveCallStatus === "ended" && "Llamada finalizada"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                      {liveCallActive && liveCallStatus === "speaking" && (
                        <button
                          type="button"
                          onClick={handleInterruptSara}
                          className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all flex items-center space-x-1.5 cursor-pointer animate-pulse shrink-0"
                          title="Interrumpir a Sara y tomar la palabra de inmediato"
                        >
                          <Hand className="w-4 h-4" />
                          <span>✋ Interrumpir</span>
                        </button>
                      )}
                      {!liveCallActive ? (
                        <button
                          type="button"
                          onClick={handleStartLiveCall}
                          className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                        >
                          <PhoneCall className="w-4 h-4" />
                          <span>Iniciar Llamada con Sara</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={endLiveCall}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                        >
                          <PhoneOff className="w-4 h-4" />
                          <span>Colgar Llamada</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panel de Conversación en Tiempo Real */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[340px] shadow-inner">
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {liveCallHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                          <Headphones className="w-10 h-10 text-emerald-500/50 mb-1" />
                          <p className="text-xs font-medium text-slate-300">
                            Presiona <strong>"Iniciar Llamada con Sara"</strong> para comenzar a hablar a viva voz.
                          </p>
                          <p className="text-[11px] text-slate-500 max-w-md">
                            Sara te saludará cordialmente en español de Colombia y te presentará DocumentTrack. Tú actuarás como el cliente para ponerla a prueba.
                          </p>
                        </div>
                      ) : (
                        liveCallHistory.map((item, idx) => {
                          const isSara = (item.speaker || "").toLowerCase().includes("sara") || (item.speaker || "").toLowerCase().includes("maggie");
                          return (
                            <div
                              key={idx}
                              className={`flex items-start space-x-2.5 ${
                                isSara ? "justify-start" : "justify-end"
                              }`}
                            >
                              {isSara && (
                                <div className="w-7 h-7 rounded-xl bg-violet-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                                  <Bot className="w-4 h-4" />
                                </div>
                              )}
                              <div
                                className={`max-w-[78%] rounded-2xl p-3 text-xs shadow-sm ${
                                  isSara
                                    ? "bg-slate-800 text-slate-100 border border-violet-500/30"
                                    : "bg-indigo-600 text-white"
                                }`}
                              >
                                <div className="flex items-center justify-between space-x-2 mb-1">
                                  <span className={`text-[10px] font-bold ${isSara ? "text-violet-300" : "text-indigo-200"}`}>
                                    {isSara ? "Sara (INNOVAIT IA • es-CO)" : `Tú (${item.label || liveCallInterlocutorLabel || "Al teléfono"})`}
                                  </span>
                                  {isSara && (
                                    <button
                                      type="button"
                                      onClick={() => playSaraAudioReply(item.text)}
                                      className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                                      title="Replay audio"
                                    >
                                      <Volume2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap">{item.text}</p>
                              </div>
                              {!isSara && (
                                <div className="w-7 h-7 rounded-xl bg-indigo-700 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                                  <User className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      {/* Burbuja en Vivo mientras el usuario está hablando */}
                      {liveInterimSpeech && (
                        <div className="flex items-start space-x-2.5 justify-end animate-pulse">
                          <div className="max-w-[78%] rounded-2xl p-3 text-xs bg-indigo-500/90 text-white border border-indigo-400 shadow-md">
                            <div className="flex items-center space-x-1.5 text-[10px] text-emerald-300 font-bold mb-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                              <span>Escuchando tu voz en vivo...</span>
                            </div>
                            <p className="italic">"{liveInterimSpeech}"</p>
                          </div>
                          <div className="w-7 h-7 rounded-xl bg-indigo-700 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                            <User className="w-4 h-4" />
                          </div>
                        </div>
                      )}

                      <div ref={liveTranscriptEndRef} />
                    </div>

                    {/* Barra de Objeciones Rápidas */}
                    {liveCallActive && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1.5 text-[10px] text-slate-400">
                          <span className="font-bold flex-shrink-0 text-slate-400">Atajos rápidos:</span>
                          {(saraContactName && !isGenericContact(saraContactName) ? [
                            `Sí, habla ${saraContactName ? saraContactName.split(" ")[0] : "Simón"}`,
                            "No, no hablo con él",
                            "Habla con Carlos de recepción",
                            "Eso no importa, dígame a mí",
                            "Trata el tema conmigo y yo le paso la información",
                            "No me interesa digitalización, nos interesa infraestructura",
                            "¿Qué servicios o portafolio manejan?",
                            "Queremos migrar nuestros servidores a AWS / Azure",
                            "Tenemos inconsistencias y duplicados en la base de datos",
                            "Nos gustaría automatizar procesos con IA",
                            "¿De qué se trata DocumentTrack?",
                            "¿Se integra con nuestro SAP / ERP?",
                            "Mándele un correo a él y lo revisa",
                            "De acuerdo, agendemos la demo para el jueves 10 AM",
                            "No me interesa, muchas gracias"
                          ] : [
                            "La persona encargada es Carlos Pérez",
                            "El correo de él es cperez@opticacolombiana.com",
                            "Lo ubica en la extensión 104",
                            "El director es Carlos Pérez, correo cperez@opticacolombiana.com y extensión 104",
                            "No tiene extensión, solo correo",
                            "Don Carlos está en reunión en este momento",
                            "Habla con él, yo soy el encargado de sistemas",
                            "¿De parte de quién y para qué asunto?",
                            "Trata el tema conmigo y yo le paso la información",
                            "Por políticas de la empresa no damos datos",
                            "No me interesa digitalización, nos interesa infraestructura",
                            "¿Qué servicios o portafolio manejan?",
                            "No nos interesa, muchas gracias"
                          ]).map((pill, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => sendUserLiveMessage(pill)}
                              className="px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex-shrink-0 transition-colors cursor-pointer"
                            >
                              "{pill}"
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Banner Interactivo mientras Sara Habla (Aviso de Barge-In) */}
                  {liveCallActive && liveCallStatus === "speaking" && (
                    <div className="p-3 bg-violet-950/70 border border-violet-500/50 rounded-2xl flex items-center justify-between text-violet-100 shadow-md animate-in fade-in">
                      <div className="flex items-center space-x-3">
                        <div className="relative flex items-center justify-center">
                          <span className="w-5 h-5 rounded-full bg-violet-400/40 animate-ping absolute"></span>
                          <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold relative z-10 shadow-sm">
                            <Volume2 className="w-4 h-4 animate-bounce" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <strong className="text-xs text-white">Sara está hablando...</strong>
                            <span className="px-1.5 py-0.5 rounded bg-violet-500/50 text-violet-200 font-bold text-[9px]">
                              INTERACTIVO (BARGE-IN ACTIVO)
                            </span>
                          </div>
                          <span className="text-[11px] text-violet-300 block">
                            Puedes hablarle por tu micrófono para interrumpirla, o presionar el botón de interrupción:
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleInterruptSara}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer shadow transition-all shrink-0 animate-pulse"
                        title="Silenciar a Sara y tomar la palabra de inmediato"
                      >
                        <Hand className="w-4 h-4" />
                        <span>Interrumpir</span>
                      </button>
                    </div>
                  )}

                  {/* Banner de Estado del Micrófono y Ondas de Audio */}
                  {liveCallActive && liveCallStatus === "listening" && (
                    <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-emerald-100 shadow-md animate-in fade-in">
                      <div className="flex items-center space-x-3">
                        <div className="relative flex items-center justify-center">
                          <span className="w-5 h-5 rounded-full bg-emerald-400/40 animate-ping absolute"></span>
                          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold relative z-10 shadow-sm">
                            <Mic className="w-4 h-4 animate-pulse" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <strong className="text-xs text-white">Sara te está escuchando...</strong>
                            {audioVolumeLevel > 10 && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-emerald-950 font-black text-[9px]">
                                VOZ DETECTADA
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-emerald-300 block">
                            {liveInterimSpeech ? `"${liveInterimSpeech}"` : "Habla a tu propio ritmo. Sara espera 2.8 segundos de pausa antes de responder, o puedes pulsar 'Enviar ahora'."}
                          </span>
                        </div>
                      </div>

                      {liveInterimSpeech && (
                        <button
                          type="button"
                          onClick={() => {
                            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                            sendUserLiveMessage(liveInterimSpeech.trim());
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs flex items-center space-x-1 cursor-pointer shadow-md transition-all flex-shrink-0"
                          title="Enviar de inmediato sin esperar la pausa de silencio"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar ahora</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Alerta si el navegador bloqueó el micrófono */}
                  {micPermissionError && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-start space-x-2.5 text-amber-900 text-xs shadow-sm">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Aviso de micrófono:</strong> {micPermissionError}
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Puedes continuar la conversación usando el campo de texto abajo o haciendo clic en los botones de "Atajos rápidos".
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Entrada de Audio (Micrófono) y Texto Fallback */}
                  {liveCallActive && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (liveCallStatus === "listening") {
                              if (recognitionRef.current) {
                                try { recognitionRef.current.abort(); } catch {}
                              }
                              setLiveCallStatus("idle");
                            } else {
                              startMicrophoneRecognition();
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-sm ${
                            liveCallStatus === "listening"
                              ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-300"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                          }`}
                        >
                          <Mic className="w-4 h-4" />
                          <span>
                            {liveCallStatus === "listening" ? "Pausar Micrófono" : "Hablar por Micrófono"}
                          </span>
                        </button>

                        <div className="flex-1 flex items-center space-x-1.5">
                          <input
                            type="text"
                            value={liveCallUserText}
                            onChange={(e) => setLiveCallUserText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && liveCallUserText.trim()) {
                                sendUserLiveMessage(liveCallUserText.trim());
                              }
                            }}
                            placeholder="O escribe aquí tu respuesta/objeción..."
                            className="flex-1 p-2 bg-white rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (liveCallUserText.trim()) {
                                sendUserLiveMessage(liveCallUserText.trim());
                              }
                            }}
                            disabled={!liveCallUserText.trim()}
                            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 3: DESPACHAR A CELULAR ANDROID */}
              {saraActiveSubTab === "dispatch" && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                        SIM
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Llamada Telefónica Real con Celular Android Dedicado
                        </h4>
                        <p className="text-xs text-slate-600">
                          El backend encolará la orden para que el celular Android físico marque mediante su SIM card colombiana local (+57).
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
                      <div className="bg-white p-3 rounded-xl border border-indigo-100">
                        <strong className="text-indigo-900 block">📞 Enrutamiento GSM Local:</strong>
                        <p className="text-slate-600 mt-0.5">
                          Tasa de respuesta superior al 80% frente a números virtuales o VoIP extranjeros bloqueados por Truecaller.
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-indigo-100">
                        <strong className="text-indigo-900 block">⚡ Inyección de Audio con Gemini Live:</strong>
                        <p className="text-slate-600 mt-0.5">
                          El módulo Magisk en Android inyecta el stream bidireccional directamente en la llamada celular activa.
                        </p>
                      </div>
                    </div>
                  </div>

                  {!saraDispatchedJob ? (
                    <div className="text-center py-6">
                      <button
                        type="button"
                        onClick={handleDispatchToAndroid}
                        disabled={saraDispatching}
                        className="px-6 py-3 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all inline-flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        <PhoneForwarded className="w-4 h-4 text-amber-300" />
                        <span>{saraDispatching ? "Encolando llamada..." : "Despachar a la Cola del Celular Android"}</span>
                      </button>
                      <p className="text-[11px] text-slate-400 mt-2">
                        El celular Android conectado marcará inmediatamente en cuanto esté desocupado.
                      </p>
                    </div>
                  ) : (
                    <div className="p-5 bg-white border border-indigo-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800">
                          ESTADO: EN COLA ({saraDispatchedJob.status})
                        </span>
                        <code className="text-xs font-mono text-slate-500">{saraDispatchedJob.job_id}</code>
                      </div>

                      <p className="text-xs text-slate-700">
                        La llamada hacia <strong>{saraDispatchedJob.contact_name}</strong> al número <strong>{saraDispatchedJob.phone}</strong> ha sido puesta en cola del celular Android exitosamente.
                      </p>

                      <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
                        <div><strong>Voz:</strong> {saraDispatchedJob.preferred_voice}</div>
                        <div><strong>Oportunidad:</strong> {saraTargetGate.company_name}</div>
                        <div><strong>Instrucciones:</strong> {saraDispatchedJob.custom_instructions || "Llamada estándar B2B DocumentTrack"}</div>
                      </div>

                      <div className="pt-2 flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            stopAudioPlayback();
                            setSaraModalOpen(false);
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
                        >
                          Cerrar y Monitorear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer General del Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Agente Sara v1.0 • INNOVAIT Transformación Digital • Powered by Gemini Live
              </span>

              <button
                type="button"
                onClick={() => {
                  stopAudioPlayback();
                  setSaraModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
