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
  PhoneCall
} from "lucide-react";

// Endpoint de API con Reverse Proxy nativo de Next.js (Mismo origen / sin bloqueos de puerto 8000 ni CORS)
const API_BASE = "/api/v1";

export default function SalesCommandCenter() {
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
        const res = await fetch(`${API_BASE}/opportunities/hunt`, {
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
        const res = await fetch(`${API_BASE}/opportunities/hunt`, {
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
        const res = await fetch(`${API_BASE}/opportunities/${oppId}/contacts`, {
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
        const res = await fetch(`${API_BASE}/catalog/service/${editingServiceId}`, {
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
        fetch(`${API_BASE}/gates/pending`).catch(() => null),
        fetch(`${API_BASE}/opportunities/`).catch(() => null),
      ]);

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
      const catRes = await fetch(`${API_BASE}/catalog/`).catch(() => null);
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
    fetchData();
    // Refrescar únicamente pipeline y compuertas en segundo plano para no sobreescribir el catálogo
    const interval = setInterval(() => {
      fetchPipelineData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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
        const res = await fetch(`${API_BASE}/gates/${oppId}/decision`, {
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
        const res = await fetch(`${API_BASE}/opportunities/`, {
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
              onClick={() => setNewOppModalOpen(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Prospecto</span>
            </button>
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
              <h3 className="text-2xl font-black text-slate-900 mt-1">5 Agentes</h3>
              <p className="text-xs text-emerald-600 mt-0.5 flex items-center">
                <Sparkles className="w-3 h-3 mr-1" /> Gemini 2.5 Flash / Pro
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
    </div>
  );
}
