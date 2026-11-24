
"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ProjectStatus = "Queued" | "Processing" | "Completed" | "Failed";
type PublishingMode = "auto" | "manual";
type PlatformId = "youtube" | "tiktok" | "instagram";

type SocialAccountStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "expired"
  | "error";

type SocialAccount = {
  id: string;
  user_id: string;
  platform: PlatformId;
  platform_user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: SocialAccountStatus;
  connected_at: string | null;
};

type Project = {
  id: string;
  url: string;
  quantity: number;
  status: ProjectStatus;
  progress?: number;
  createdAt: string;
  platforms: PlatformId[];
  attemptCount?: number;
  storage: "database" | "local";
};

const STORAGE_KEY = "clipflow-projects";

const socialPlatforms: {
  id: PlatformId;
  name: string;
  description: string;
  icon: string;
  color: string;
  border: string;
}[] = [
  {
    id: "youtube",
    name: "YouTube Shorts",
    description: "Hubungkan channel YouTube untuk publikasi Shorts.",
    icon: "▶",
    color: "text-red-400",
    border: "border-red-500/20",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Hubungkan akun TikTok untuk publikasi video.",
    icon: "♪",
    color: "text-pink-400",
    border: "border-pink-500/20",
  },
  {
    id: "instagram",
    name: "Instagram Reels",
    description: "Hubungkan akun Instagram untuk publikasi Reels.",
    icon: "◎",
    color: "text-fuchsia-400",
    border: "border-fuchsia-500/20",
  },
];

const defaultPlatforms: PlatformId[] = [
  "youtube",
  "tiktok",
  "instagram",
];

function getPlatformNames(platformIds: PlatformId[]) {
  return socialPlatforms
    .filter((platform) => platformIds.includes(platform.id))
    .map((platform) => platform.name);
}

function getPlatformIds(values: unknown): PlatformId[] {
  if (!Array.isArray(values)) return [];

  return values.flatMap((value) => {
    const match = socialPlatforms.find(
      (platform) => platform.id === value || platform.name === value
    );

    return match ? [match.id] : [];
  });
}

function getStatusColor(status: ProjectStatus) {
  switch (status) {
    case "Completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "Processing":
      return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    case "Failed":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  }
}

function getSocialStatusInfo(status: SocialAccountStatus) {
  switch (status) {
    case "connected":
      return {
        label: "Terhubung",
        color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      };

    case "connecting":
      return {
        label: "Menghubungkan",
        color: "border-blue-500/30 bg-blue-500/10 text-blue-400",
      };

    case "expired":
      return {
        label: "Token Kedaluwarsa",
        color: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      };

    case "error":
      return {
        label: "Error",
        color: "border-red-500/30 bg-red-500/10 text-red-400",
      };

    default:
      return {
        label: "Terputus",
        color: "border-gray-500/30 bg-gray-500/10 text-gray-400",
      };
  }
}

export default function Home() {
  const router = useRouter();

  const myProjectsRef = useRef<HTMLDivElement>(null);
  const processingQueueRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const socialMediaRef = useRef<HTMLDivElement>(null);

  const scrollToMyProjects = () =>
    myProjectsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

  const scrollToProcessingQueue = () =>
    processingQueueRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

  const scrollToSettings = () =>
    settingsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

  const scrollToSocialMedia = () =>
    socialMediaRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

  const [url, setUrl] = useState("");
  const [quantity, setQuantity] = useState("5");
  const [status, setStatus] = useState("Menunggu video");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [accountEmail, setAccountEmail] = useState("");
  const [accountUserId, setAccountUserId] = useState("");
  const [dailyTarget, setDailyTarget] = useState(5);

  const [publishingMode, setPublishingMode] =
    useState<PublishingMode>("auto");

  const [selectedPlatforms, setSelectedPlatforms] =
    useState<PlatformId[]>(defaultPlatforms);

  const [projectPlatforms, setProjectPlatforms] =
    useState<PlatformId[]>(defaultPlatforms);

  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  // SOCIAL MEDIA DATABASE STATE
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [socialAccountsLoading, setSocialAccountsLoading] = useState(true);
  const [socialAccountsRefreshing, setSocialAccountsRefreshing] =
    useState(false);
  const [socialAccountsError, setSocialAccountsError] = useState("");
  const [disconnectingAccountId, setDisconnectingAccountId] =
    useState<string | null>(null);

  // STATE SIMULASI
  const [processingProjectId, setProcessingProjectId] = useState<string | null>(
    null
  );

  // PENGUNCI LANGSUNG AGAR HANYA SATU PROJECT BERJALAN
  const processingLockRef = useRef<string | null>(null);

  // LOGOUT
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("Gagal logout: " + error.message);
      return;
    }

    router.replace("/login");
  };

  // SOCIAL MEDIA CONNECTION
  // OAuth belum diaktifkan.
  const handlePlatformConnect = (platform: string) => {
    alert(
      `Koneksi ${platform} belum diaktifkan.\n\nIntegrasi OAuth dan API resmi platform ini perlu dikonfigurasi terlebih dahulu.`
    );
  };

  // LOAD SOCIAL MEDIA ACCOUNTS
  async function loadSocialAccounts(userId: string, showRefresh = false) {
    if (showRefresh) {
      setSocialAccountsRefreshing(true);
    } else {
      setSocialAccountsLoading(true);
    }

    setSocialAccountsError("");

    try {
      const { data, error } = await supabase
        .from("social_accounts")
        .select(
          "id, user_id, platform, platform_user_id, username, display_name, avatar_url, status, connected_at"
        )
        .eq("user_id", userId)
        .order("connected_at", { ascending: false });

      if (error) throw error;

      const accounts = (data ?? []) as SocialAccount[];

      setSocialAccounts(accounts);
    } catch (error: unknown) {
      console.error("Load social accounts error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Gagal membaca akun media sosial.";

      setSocialAccountsError(message);
    } finally {
      setSocialAccountsLoading(false);
      setSocialAccountsRefreshing(false);
    }
  }

  // REFRESH SOCIAL MEDIA ACCOUNTS
  const handleRefreshSocialAccounts = async () => {
    if (!accountUserId) {
      setSocialAccountsError("Akun pengguna belum tersedia.");
      return;
    }

    await loadSocialAccounts(accountUserId, true);
  };

  // DISCONNECT SOCIAL MEDIA ACCOUNT
  async function handleDisconnectSocialAccount(account: SocialAccount) {
    if (disconnectingAccountId !== null) return;

    const platform = socialPlatforms.find(
      (item) => item.id === account.platform
    );

    const accountName =
      account.display_name ||
      account.username ||
      account.platform_user_id ||
      "akun ini";

    const confirmed = window.confirm(
      `Apakah kamu yakin ingin menghapus koneksi ${platform?.name ?? account.platform}?\n\nAkun: ${accountName}\n\nData koneksi ini akan dihapus dari database CLIPFLOW AI.`
    );

    if (!confirmed) return;

    setDisconnectingAccountId(account.id);
    setSocialAccountsError("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const user = sessionData.session?.user;

      if (!user) {
        throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
      }

      if (user.id !== accountUserId || user.id !== account.user_id) {
        throw new Error(
          "Akses ditolak. Akun ini bukan milik pengguna yang sedang login."
        );
      }

      const { data: deletedAccount, error: deleteError } = await supabase
        .from("social_accounts")
        .delete()
        .eq("id", account.id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (deleteError) throw deleteError;

      if (!deletedAccount) {
        throw new Error(
          "Akun tidak ditemukan atau tidak dapat dihapus. Silakan muat ulang daftar akun."
        );
      }

      // MUAT ULANG DATA DARI SUPABASE
      await loadSocialAccounts(user.id, true);

      setStatus(
        `Koneksi ${platform?.name ?? "media sosial"} berhasil dihapus dari database.`
      );
    } catch (error: unknown) {
      console.error("Disconnect social account error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Gagal menghapus koneksi akun.";

      setSocialAccountsError(message);
      alert("Gagal disconnect akun: " + message);
    } finally {
      setDisconnectingAccountId(null);
    }
  }

  // DAILY TARGET
  const handleDailyTargetChange = (value: string) => {
    const target = Number(value);

    if (!Number.isInteger(target) || target < 1 || target > 20) {
      return;
    }

    setDailyTarget(target);

    if (accountUserId) {
      localStorage.setItem(
        `${STORAGE_KEY}-${accountUserId}-daily-target`,
        String(target)
      );
    }
  };

  // DEFAULT PLATFORM TOGGLE
  const handlePlatformToggle = (platform: PlatformId) => {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  };

  // PROJECT PLATFORM TOGGLE
  const handleProjectPlatformToggle = (platform: PlatformId) => {
    setProjectPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  };

  // SAVE PUBLISHING PREFERENCES
  const handleSavePreferences = async () => {
    if (preferencesSaving) return;

    if (!accountUserId) {
      alert("Akun belum siap. Silakan login kembali.");
      return;
    }

    if (selectedPlatforms.length === 0) {
      alert("Pilih minimal satu platform publikasi.");
      return;
    }

    setPreferencesSaving(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.user) {
        throw new Error(
          "Sesi login tidak ditemukan. Silakan login kembali."
        );
      }

      const userId = sessionData.session.user.id;

      const databaseMode =
        publishingMode === "auto" ? "automatic" : "manual";

      const { error } = await supabase
        .from("publishing_preferences")
        .upsert(
          {
            user_id: userId,
            publishing_mode: databaseMode,
            default_platforms: selectedPlatforms,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      setStatus("Pengaturan publikasi berhasil disimpan.");
      alert("Pengaturan publikasi berhasil disimpan ke Supabase!");
    } catch (error: unknown) {
      console.error("Save publishing preferences error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan pengaturan.";

      alert("Gagal menyimpan pengaturan: " + message);
    } finally {
      setPreferencesSaving(false);
    }
  };

  // LOAD ACCOUNT, PREFERENCES, PROJECTS AND SOCIAL ACCOUNTS
  useEffect(() => {
    let active = true;

    async function loadProjects() {
      let localProjects: Project[] = [];
      let redirecting = false;

      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          redirecting = true;
          router.replace("/login");
          return;
        }

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) {
          if (userError.status === 401) {
            redirecting = true;
            await supabase.auth.signOut();
            router.replace("/login");
            return;
          }

          throw userError;
        }

        if (!userData.user) {
          redirecting = true;
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        const user = userData.user;

        const userStorageKey = `${STORAGE_KEY}-${user.id}`;

        if (!active) return;

        setAccountEmail(user.email ?? "Email tidak tersedia");
        setAccountUserId(user.id);

        // LOAD SOCIAL MEDIA ACCOUNTS
        await loadSocialAccounts(user.id);

        if (!active) return;

        // LOAD DAILY TARGET
        const savedTarget = localStorage.getItem(
          `${userStorageKey}-daily-target`
        );

        if (savedTarget) {
          const parsedTarget = Number(savedTarget);

          if (
            Number.isInteger(parsedTarget) &&
            parsedTarget >= 1 &&
            parsedTarget <= 20
          ) {
            setDailyTarget(parsedTarget);
          }
        }

        // LOAD PUBLISHING PREFERENCES
        setPreferencesLoading(true);

        try {
          const { data: preferenceData, error: preferenceError } =
            await supabase
              .from("publishing_preferences")
              .select("publishing_mode, default_platforms")
              .eq("user_id", user.id)
              .maybeSingle();

          if (preferenceError) throw preferenceError;

          if (!active) return;

          if (preferenceData) {
            setPublishingMode(
              preferenceData.publishing_mode === "manual"
                ? "manual"
                : "auto"
            );

            const validPlatforms = getPlatformIds(
              preferenceData.default_platforms
            );

            const safePlatforms =
              validPlatforms.length > 0
                ? validPlatforms
                : [...defaultPlatforms];

            setSelectedPlatforms(safePlatforms);
            setProjectPlatforms(safePlatforms);
          } else {
            setPublishingMode("auto");
            setSelectedPlatforms([...defaultPlatforms]);
            setProjectPlatforms([...defaultPlatforms]);
          }
        } catch (preferenceError) {
          console.error(
            "Load publishing preferences error:",
            preferenceError
          );

          if (active) {
            setPublishingMode("auto");
            setSelectedPlatforms([...defaultPlatforms]);
            setProjectPlatforms([...defaultPlatforms]);

            setStatus(
              "Pengaturan default digunakan. Kamu bisa menyimpannya kembali melalui Settings."
            );
          }
        } finally {
          if (active) setPreferencesLoading(false);
        }

        if (!active) return;

        // LOAD LOCAL STORAGE PROJECTS
        try {
          const saved = localStorage.getItem(userStorageKey);

          if (saved) {
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed)) {
              localProjects = parsed.map((project) => {
                const savedPlatforms = getPlatformIds(project.platforms);

                return {
                  ...project,
                  storage: "local" as const,
                  platforms:
                    savedPlatforms.length > 0
                      ? savedPlatforms
                      : [...defaultPlatforms],
                };
              });
            }
          }
        } catch {
          console.error("Gagal membaca LocalStorage");
        }

        // LOAD SUPABASE PROJECTS
        const { data, error } = await supabase
          .from("projects")
          .select(
            "id, source_url, clip_count, status, progress, created_at, platforms, attempt_count"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const databaseProjects: Project[] = (data || []).map(
          (project: {
            id: string;
            source_url: string;
            clip_count: number;
            status: string;
            progress: number | null;
            created_at: string;
            platforms: unknown;
            attempt_count: number | null;
          }) => {
            const savedPlatforms = getPlatformIds(project.platforms);

            return {
              id: project.id,
              storage: "database" as const,
              url: project.source_url,
              quantity: project.clip_count,
              progress: project.progress ?? 0,
              attemptCount: project.attempt_count ?? 0,
              platforms:
                savedPlatforms.length > 0
                  ? savedPlatforms
                  : [...defaultPlatforms],
              status:
                project.status === "processing"
                  ? "Processing"
                  : project.status === "completed"
                    ? "Completed"
                    : project.status === "failed"
                      ? "Failed"
                      : "Queued",
              createdAt: new Date(project.created_at).toLocaleString("id-ID"),
            };
          }
        );

        const databaseIds = new Set(
          databaseProjects.map((project) => project.id)
        );

        const combinedProjects = [
          ...databaseProjects,
          ...localProjects.filter(
            (project) => !databaseIds.has(project.id)
          ),
        ];

        if (!active) return;

        setProjects(combinedProjects);

        localStorage.setItem(
          userStorageKey,
          JSON.stringify(combinedProjects)
        );

        setStatus("Data proyek berhasil dimuat.");
      } catch (error: unknown) {
        console.error("Supabase load error:", error);

        if (!active) return;

        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error);

        setProjects(localProjects);
        setStatus("Supabase Error: " + errorMessage);
      } finally {
        if (active && !redirecting) {
          setAuthChecking(false);
          setLoaded(true);
        }
      }
    }

    loadProjects();

    return () => {
      active = false;
    };
  }, [router]);

  // SIMPAN PERUBAHAN PROYEK KE STATE DAN LOCAL STORAGE
  const updateLocalProject = (
    projectId: string,
    changes: Partial<Project>
  ) => {
    setProjects((current) => {
      const updated = current.map((project) =>
        project.id === projectId
          ? { ...project, ...changes }
          : project
      );

      if (accountUserId) {
        localStorage.setItem(
          `${STORAGE_KEY}-${accountUserId}`,
          JSON.stringify(updated)
        );
      }

      return updated;
    });
  };

  // CREATE NEW PROJECT
  async function handleProcess() {
    if (saving) return;

    if (!url.trim()) {
      setStatus("Masukkan link video terlebih dahulu.");
      return;
    }

    const activeProjectPlatforms =
      publishingMode === "auto"
        ? selectedPlatforms
        : projectPlatforms;

    if (activeProjectPlatforms.length === 0) {
      setStatus(
        publishingMode === "auto"
          ? "Pilih minimal satu Platform Default di Settings."
          : "Pilih minimal satu platform untuk proyek ini."
      );
      return;
    }

    let videoUrl: URL;

    try {
      videoUrl = new URL(url.trim());

      if (
        videoUrl.protocol !== "https:" &&
        videoUrl.protocol !== "http:"
      ) {
        throw new Error("URL tidak valid");
      }
    } catch {
      setStatus("Masukkan URL video yang valid.");
      return;
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.user) {
      setStatus("Silakan login kembali.");
      router.replace("/login");
      return;
    }

    const user = sessionData.session.user;
    const userStorageKey = `${STORAGE_KEY}-${user.id}`;

    setSaving(true);
    setStatus("Menyimpan proyek...");

    const newProject: Project = {
      id: crypto.randomUUID(),
      storage: "local",
      url: videoUrl.href,
      quantity: Number(quantity),
      status: "Queued",
      progress: 0,
      createdAt: new Date().toLocaleString("id-ID"),
      platforms: [...activeProjectPlatforms],
      attemptCount: 0,
    };

    try {
      const platformNames = getPlatformNames(activeProjectPlatforms);

      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          source_url: videoUrl.href,
          clip_count: Number(quantity),
          aspect_ratio: "9:16",
          platforms: platformNames,
          status: "queued",
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;

      const savedPlatforms = getPlatformIds(data.platforms);

      const savedProject: Project = {
        id: data.id,
        storage: "database",
        url: data.source_url,
        quantity: data.clip_count,
        status: "Queued",
        progress: 0,
        createdAt: new Date(data.created_at).toLocaleString("id-ID"),
        platforms:
          savedPlatforms.length > 0
            ? savedPlatforms
            : [...activeProjectPlatforms],
        attemptCount: data.attempt_count ?? 0,
      };

      const updatedProjects = [savedProject, ...projects];

      setProjects(updatedProjects);

      localStorage.setItem(
        userStorageKey,
        JSON.stringify(updatedProjects)
      );

      setUrl("");
      setStatus(
        publishingMode === "auto"
          ? "Proyek berhasil disimpan menggunakan platform default!"
          : "Proyek berhasil disimpan dengan pilihan platform manual!"
      );
    } catch (error) {
      console.error("Supabase insert error:", error);

      const updatedProjects = [newProject, ...projects];

      try {
        localStorage.setItem(
          userStorageKey,
          JSON.stringify(updatedProjects)
        );

        setProjects(updatedProjects);
        setUrl("");

        setStatus(
          "Database gagal. Proyek disimpan sementara di browser. Proyek lokal tidak bisa dijalankan melalui simulasi Supabase."
        );
      } catch {
        setStatus("Gagal menyimpan proyek. Periksa penyimpanan browser.");
      }
    } finally {
      setSaving(false);
    }
  }

  // MULAI / LANJUTKAN SIMULASI PEMROSESAN
  async function handleStartSimulation(projectId: string) {
    if (processingLockRef.current !== null) {
      alert(
        "Masih ada proyek yang sedang disimulasikan. Tunggu sampai selesai."
      );
      return;
    }

    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      alert("Proyek tidak ditemukan.");
      return;
    }

    if (project.storage !== "database") {
      alert(
        "Proyek ini hanya tersimpan di browser. Simulasi Supabase tidak dapat dijalankan."
      );
      return;
    }

    if (project.status === "Completed") {
      alert("Proyek ini sudah selesai.");
      return;
    }

    processingLockRef.current = projectId;
    setProcessingProjectId(projectId);

    let databaseProcessingStarted = false;
    let ownerId: string | null = null;

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.user) {
        alert("Sesi login tidak ditemukan. Silakan login kembali.");
        router.replace("/login");
        return;
      }

      const user = sessionData.session.user;
      ownerId = user.id;

      const startingProgress = Math.min(
        90,
        Math.max(0, project.progress ?? 0)
      );

      const nextAttempt =
        project.status === "Processing"
          ? project.attemptCount ?? 1
          : (project.attemptCount ?? 0) + 1;

      const startedAt = new Date().toISOString();

      setStatus("Menyiapkan simulasi pemrosesan...");

      const { data: startedProject, error: startError } =
        await supabase
          .from("projects")
          .update({
            status: "processing",
            progress: startingProgress,
            started_at: startedAt,
            completed_at: null,
            attempt_count: nextAttempt,
            locked_at: startedAt,
            locked_by: user.id,
          })
          .eq("id", projectId)
          .eq("user_id", user.id)
          .select("id")
          .single();

      if (startError) throw startError;

      if (!startedProject) {
        throw new Error(
          "Proyek tidak ditemukan atau tidak dapat diperbarui."
        );
      }

      databaseProcessingStarted = true;

      updateLocalProject(projectId, {
        status: "Processing",
        progress: startingProgress,
        attemptCount: nextAttempt,
      });

      setStatus("Simulasi sedang berjalan...");

      for (
        let progress = Math.min(
          100,
          Math.floor(startingProgress / 10) * 10 + 10
        );
        progress <= 100;
        progress += 10
      ) {
        await new Promise((resolve) => setTimeout(resolve, 800));

        const isCompleted = progress >= 100;
        const completedAt = isCompleted
          ? new Date().toISOString()
          : null;

        const { data: updatedProject, error: progressError } =
          await supabase
            .from("projects")
            .update({
              status: isCompleted ? "completed" : "processing",
              progress: Math.min(progress, 100),
              completed_at: completedAt,
              locked_at: isCompleted ? null : startedAt,
              locked_by: isCompleted ? null : user.id,
            })
            .eq("id", projectId)
            .eq("user_id", user.id)
            .select("id")
            .single();

        if (progressError) throw progressError;

        if (!updatedProject) {
          throw new Error(
            "Proyek tidak ditemukan saat memperbarui progres."
          );
        }

        updateLocalProject(projectId, {
          status: isCompleted ? "Completed" : "Processing",
          progress: Math.min(progress, 100),
        });

        if (isCompleted) {
          setStatus("Simulasi proyek berhasil diselesaikan!");
        }
      }
    } catch (error: unknown) {
      console.error("Simulation error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat simulasi.";

      if (databaseProcessingStarted && ownerId) {
        const { data: failedProject, error: failedUpdateError } =
          await supabase
            .from("projects")
            .update({
              status: "failed",
              locked_at: null,
              locked_by: null,
            })
            .eq("id", projectId)
            .eq("user_id", ownerId)
            .select("id")
            .maybeSingle();

        if (!failedUpdateError && failedProject) {
          updateLocalProject(projectId, {
            status: "Failed",
          });
        }
      }

      setStatus("Simulasi gagal: " + message);
      alert("Simulasi gagal: " + message);
    } finally {
      processingLockRef.current = null;
      setProcessingProjectId(null);
    }
  }

  const queuedCount = projects.filter(
    (project) => project.status === "Queued"
  ).length;

  const processingCount = projects.filter(
    (project) => project.status === "Processing"
  ).length;

  const completedCount = projects.filter(
    (project) => project.status === "Completed"
  ).length;

  const queueProjects = projects.filter(
    (project) =>
      project.status === "Queued" || project.status === "Processing"
  );

  // TOMBOL SIMULASI
  const renderSimulationButton = (project: Project) => {
    if (project.storage !== "database") {
      return (
        <button
          type="button"
          disabled
          title="Proyek ini hanya tersimpan di browser."
          className="w-full rounded-xl bg-gray-700 px-4 py-3 text-xs font-bold text-gray-300 opacity-60 cursor-not-allowed sm:w-auto"
        >
          Penyimpanan Lokal
        </button>
      );
    }

    const isBusy = processingProjectId === project.id;
    const anotherIsBusy =
      processingProjectId !== null && !isBusy;

    let buttonText = "▶ Mulai Simulasi";

    if (isBusy) {
      buttonText = "⏳ MENJALANKAN...";
    } else if (project.status === "Processing") {
      buttonText = "↻ Lanjutkan Simulasi";
    } else if (project.status === "Failed") {
      buttonText = "↻ Coba Lagi";
    } else if (project.status === "Completed") {
      buttonText = "✓ Selesai";
    }

    return (
      <button
        type="button"
        onClick={() => handleStartSimulation(project.id)}
        disabled={
          isBusy ||
          anotherIsBusy ||
          project.status === "Completed"
        }
        className="w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {buttonText}
      </button>
    );
  };

  // AUTHENTICATION LOADING
  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090f] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-black">
            <span className="text-violet-400">CLIP</span>FLOW AI
          </h1>
          <p className="mt-4 text-sm text-gray-400">Memeriksa akun...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090f] text-white">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden w-64 border-r border-white/10 bg-[#0d0d16] p-6 md:block">
          <div className="mb-12">
            <h1 className="text-2xl font-black tracking-tight">
              <span className="text-violet-400">CLIP</span>FLOW AI
            </h1>
            <p className="mt-2 text-xs text-gray-500">
              Automated Video Studio
            </p>
          </div>

          <nav className="space-y-3 text-sm">
            <div className="rounded-xl bg-violet-600/20 px-4 py-3 text-violet-300">
              ◈ Dashboard
            </div>

            <button
              type="button"
              onClick={scrollToMyProjects}
              className="w-full rounded-xl px-4 py-3 text-left text-gray-400 transition hover:bg-violet-600/20 hover:text-violet-300"
            >
              ▣ My Projects ({projects.length})
            </button>

            <button
              type="button"
              onClick={scrollToProcessingQueue}
              className="w-full rounded-xl px-4 py-3 text-left text-gray-400 transition hover:bg-violet-600/20 hover:text-violet-300"
            >
              ◷ Processing Queue ({queueProjects.length})
            </button>

            <button
              type="button"
              onClick={scrollToSocialMedia}
              className="w-full rounded-xl px-4 py-3 text-left text-gray-400 transition hover:bg-violet-600/20 hover:text-violet-300"
            >
              ↗ Social Media ({socialAccounts.length})
            </button>

            <button
              type="button"
              onClick={scrollToSettings}
              className="w-full rounded-xl px-4 py-3 text-left text-gray-400 transition hover:bg-violet-600/20 hover:text-violet-300"
            >
              ⚙ Settings
            </button>
          </nav>

          <div className="mt-16 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-gray-400">DAILY TARGET</p>
            <p className="mt-2 text-3xl font-bold">{dailyTarget} Videos</p>
            <p className="mt-1 text-xs text-gray-500">
              Target produksi harian
            </p>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section className="flex-1 p-5 md:p-10">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">WORKSPACE / OVERVIEW</p>
              <h2 className="mt-2 text-3xl font-bold">Dashboard</h2>
              <p className="mt-2 text-sm text-gray-400">
                Kelola produksi video pendek otomatis.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
                ● System Online
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/20"
              >
                Logout
              </button>
            </div>
          </header>

          {/* STATISTICS */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Target Harian", String(dailyTarget), "Video per hari"],
              ["Video Diproses", String(processingCount), "Sedang disimulasikan"],
              ["Video Selesai", String(completedCount), "Simulasi selesai"],
            ].map(([title, value, description]) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-[#12121c] p-6"
              >
                <p className="text-sm text-gray-400">{title}</p>
                <p className="mt-3 text-4xl font-bold">{value}</p>
                <p className="mt-2 text-xs text-gray-500">{description}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* CREATE PROJECT */}
            <div className="rounded-2xl border border-white/10 bg-[#12121c] p-6 lg:col-span-2">
              <div className="mb-6">
                <h3 className="text-xl font-bold">Create New Clips</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Masukkan URL video sumber yang kamu punya izin untuk gunakan.
                </p>
              </div>

              <label className="mb-2 block text-sm text-gray-300">
                Video URL
              </label>

              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-sm outline-none transition focus:border-violet-500"
              />

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Jumlah video
                  </label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#1b1b28] px-4 py-3"
                  >
                    <option value="1">1 Video</option>
                    <option value="3">3 Video</option>
                    <option value="5">5 Video</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Format video
                  </label>
                  <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
                    9:16 Portrait (1080 × 1920)
                  </div>
                </div>
              </div>

              {/* PROJECT PLATFORM SELECTION */}
              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-300">
                  Publishing destinations
                </p>

                {publishingMode === "auto" ? (
                  <>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      Mode Otomatis aktif. Platform proyek mengikuti Platform Default
                      yang tersimpan di Settings.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {socialPlatforms.map((platform) => {
                        const isSelected = selectedPlatforms.includes(platform.id);

                        return (
                          <div
                            key={platform.id}
                            className={`flex items-center gap-3 rounded-xl border p-4 ${
                              isSelected
                                ? "border-violet-500/50 bg-violet-500/10"
                                : "border-white/10 bg-black/20 opacity-40"
                            }`}
                          >
                            <span className={`text-xl ${platform.color}`}>
                              {platform.icon}
                            </span>
                            <span className="text-xs font-medium">
                              {platform.name}
                            </span>
                            <span className="ml-auto text-xs">
                              {isSelected ? "✓" : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-xs text-violet-300">
                      {selectedPlatforms.length} platform default digunakan.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      Mode Manual aktif. Pilih sendiri platform tujuan untuk proyek ini.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {socialPlatforms.map((platform) => {
                        const isSelected = projectPlatforms.includes(platform.id);

                        return (
                          <label
                            key={platform.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                              isSelected
                                ? "border-violet-500/50 bg-violet-500/10"
                                : "border-white/10 bg-black/20 hover:bg-white/5"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                handleProjectPlatformToggle(platform.id)
                              }
                              className="h-4 w-4 accent-violet-500"
                            />

                            <span className={`text-xl ${platform.color}`}>
                              {platform.icon}
                            </span>

                            <span className="text-xs font-medium">
                              {platform.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-xs text-gray-500">
                      {projectPlatforms.length} platform dipilih untuk proyek ini.
                    </p>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleProcess}
                disabled={!loaded || saving || preferencesLoading}
                className="mt-8 w-full rounded-xl bg-violet-600 py-4 font-bold transition hover:bg-violet-500 disabled:opacity-50"
              >
                {saving ? "⏳ MENYIMPAN..." : "✦ SIMPAN PROYEK"}
              </button>

              <p className="mt-4 text-center text-xs text-gray-400">
                {status}
              </p>
            </div>

            {/* PRODUCTION STATUS */}
            <div className="rounded-2xl border border-white/10 bg-[#12121c] p-6">
              <h3 className="text-lg font-bold">Production Status</h3>

              {projects.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-white/15 p-6 text-center">
                  <div className="text-4xl">🎬</div>
                  <p className="mt-4 text-sm font-medium">No videos yet</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Video yang disimpan akan muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                    <p className="text-2xl font-bold text-violet-400">
                      {queuedCount}
                    </p>
                    <p className="text-xs text-gray-400">
                      Video dalam antrean
                    </p>
                  </div>

                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <p className="text-2xl font-bold text-blue-400">
                      {processingCount}
                    </p>
                    <p className="text-xs text-gray-400">
                      Sedang diproses
                    </p>
                  </div>

                  <p className="text-xs text-gray-500">Proyek terbaru</p>

                  {projects.slice(0, 3).map((project) => (
                    <div
                      key={project.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <p className="truncate text-xs text-gray-300">
                        {project.url}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        {project.status} · {project.progress ?? 0}%
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-sm font-medium">AI Engine</p>
                <p className="mt-2 text-xs text-amber-400">
                  ● Belum terhubung
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Progress saat ini merupakan simulasi. Mesin pemrosesan AI
                  sungguhan akan diintegrasikan pada tahap berikutnya.
                </p>
              </div>
            </div>
          </div>

          {/* MY PROJECTS */}
          <div
            ref={myProjectsRef}
            className="mt-8 scroll-mt-8 rounded-2xl border border-white/10 bg-[#12121c] p-6"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">My Projects</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Semua proyek video yang sudah disimpan.
                </p>
              </div>
              <span className="rounded-full bg-violet-500/10 px-4 py-2 text-xs text-violet-300">
                {projects.length} Projects
              </span>
            </div>

            {projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
                <p className="text-3xl">📁</p>
                <p className="mt-3 text-sm text-gray-400">
                  Belum ada proyek tersimpan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project, index) => (
                  <div
                    key={project.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          Project #{projects.length - index}
                        </p>
                        <p className="mt-2 truncate text-xs text-gray-400">
                          {project.url}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          {project.quantity} video · {project.createdAt}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.platforms?.length > 0 ? (
                            project.platforms.map((platformId) => {
                              const platform = socialPlatforms.find(
                                (item) => item.id === platformId
                              );

                              if (!platform) return null;

                              return (
                                <span
                                  key={platformId}
                                  className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-300"
                                >
                                  {platform.icon} {platform.name}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-gray-500">
                              Belum ada platform
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-3 sm:items-end">
                        <span
                          className={`w-fit rounded-full border px-3 py-2 text-xs ${getStatusColor(project.status)}`}
                        >
                          ● {project.status}
                        </span>
                        {renderSimulationButton(project)}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-gray-400">Progress simulasi</span>
                        <span className="font-semibold text-blue-400">
                          {project.progress ?? 0}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{
                            width: `${project.progress ?? 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PROCESSING QUEUE */}
          <div
            ref={processingQueueRef}
            className="mt-8 scroll-mt-8 rounded-2xl border border-white/10 bg-[#12121c] p-6"
          >
            <h3 className="text-xl font-bold">Processing Queue</h3>
            <p className="mt-2 text-sm text-gray-400">
              Proyek yang menunggu atau sedang menjalani simulasi pemrosesan.
            </p>

            <div className="mt-6 space-y-3">
              {queueProjects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-gray-500">
                  Antrean masih kosong.
                </p>
              ) : (
                queueProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Queue #{index + 1}
                        </p>
                        <p className="mt-2 max-w-lg truncate text-xs text-gray-400">
                          {project.url}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          Target: {project.quantity} video
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-3 sm:items-end">
                        <span
                          className={`w-fit rounded-full border px-3 py-2 text-xs ${getStatusColor(project.status)}`}
                        >
                          {project.status}
                        </span>
                        {renderSimulationButton(project)}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-blue-400">
                          {project.progress ?? 0}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{
                            width: `${project.progress ?? 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SOCIAL MEDIA */}
          <div
            ref={socialMediaRef}
            className="mt-8 scroll-mt-8 rounded-2xl border border-white/10 bg-[#12121c] p-6"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-violet-400">PUBLISHING CHANNELS</p>
                <h3 className="mt-2 text-xl font-bold">Social Media</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Kelola platform tujuan untuk publikasi video pendek.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefreshSocialAccounts}
                disabled={socialAccountsRefreshing || socialAccountsLoading}
                className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                {socialAccountsRefreshing
                  ? "⏳ Memuat..."
                  : "↻ Refresh Akun"}
              </button>
            </div>

            {socialAccountsError && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm font-semibold text-red-400">
                  Gagal memuat data Social Media
                </p>
                <p className="mt-2 break-words text-xs leading-5 text-red-300">
                  {socialAccountsError}
                </p>
                <button
                  type="button"
                  onClick={handleRefreshSocialAccounts}
                  className="mt-3 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {socialAccountsLoading ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-10 text-center">
                <p className="text-sm text-gray-400">
                  ⏳ Memuat akun media sosial dari Supabase...
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {socialPlatforms.map((platform) => {
                  const platformAccounts = socialAccounts.filter(
                    (account) => account.platform === platform.id
                  );

                  return (
                    <div
                      key={platform.id}
                      className={`rounded-xl border ${platform.border} bg-black/20 p-5`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-3xl ${platform.color}`}>
                          {platform.icon}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400">
                          {platformAccounts.length} Akun
                        </span>
                      </div>

                      <h4 className="mt-5 font-semibold">{platform.name}</h4>

                      <p className="mt-2 min-h-12 text-xs leading-5 text-gray-400">
                        {platform.description}
                      </p>

                      {platformAccounts.length === 0 ? (
                        <div className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-center">
                          <p className="text-xs text-gray-500">
                            Belum ada akun tersimpan.
                          </p>
                          <span className="mt-2 inline-block rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                            Belum terhubung
                          </span>
                        </div>
                      ) : (
                        <div className="mt-5 space-y-3">
                          {platformAccounts.map((account) => {
                            const statusInfo = getSocialStatusInfo(
                              account.status
                            );

                            const accountName =
                              account.display_name ||
                              account.username ||
                              account.platform_user_id ||
                              "Akun tanpa nama";

                            return (
                              <div
                                key={account.id}
                                className="rounded-xl border border-white/10 bg-[#12121c] p-4"
                              >
                                <div className="flex items-center gap-3">
                                  {account.avatar_url ? (
                                    <img
                                      src={account.avatar_url}
                                      alt={accountName}
                                      referrerPolicy="no-referrer"
                                      className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-violet-500/10 text-lg font-bold text-violet-300">
                                      {accountName.charAt(0).toUpperCase()}
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-white">
                                      {account.display_name || accountName}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-gray-400">
                                      {account.username
                                        ? `@${account.username.replace(/^@/, "")}`
                                        : "Username tidak tersedia"}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <span
                                    className={`inline-block rounded-full border px-3 py-1 text-xs ${statusInfo.color}`}
                                  >
                                    {statusInfo.label}
                                  </span>
                                </div>

                                {account.connected_at && (
                                  <p className="mt-3 text-xs text-gray-500">
                                    Terhubung:{" "}
                                    {new Date(
                                      account.connected_at
                                    ).toLocaleDateString("id-ID")}
                                  </p>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDisconnectSocialAccount(account)
                                  }
                                  disabled={
                                    disconnectingAccountId !== null
                                  }
                                  className="mt-4 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {disconnectingAccountId === account.id
                                    ? "⏳ Menghapus..."
                                    : "Disconnect Account"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePlatformConnect(platform.name)}
                        className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-gray-300 transition hover:bg-violet-600/20 hover:text-violet-300"
                      >
                        + Persiapkan Koneksi
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="text-sm font-medium text-violet-300">
                Informasi Integrasi
              </p>
              <p className="mt-2 text-xs leading-5 text-gray-400">
                Data akun dibaca dari Supabase berdasarkan user yang sedang
                login. Disconnect menghapus data koneksi dari database.
                OAuth dan API resmi belum diaktifkan. Token akses harus
                ditangani secara aman di sisi server ketika integrasi resmi
                mulai dikembangkan.
              </p>
            </div>
          </div>

          {/* SETTINGS */}
          <div
            ref={settingsRef}
            className="mt-8 scroll-mt-8 rounded-2xl border border-white/10 bg-[#12121c] p-6"
          >
            <div className="mb-6">
              <p className="text-sm text-violet-400">ACCOUNT PREFERENCES</p>
              <h3 className="mt-2 text-xl font-bold">Settings</h3>
              <p className="mt-2 text-sm text-gray-400">
                Kelola informasi akun dan preferensi dashboard.
              </p>
            </div>

            {/* ACCOUNT INFORMATION */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <h4 className="font-semibold">Informasi Akun</h4>
              <div className="mt-4">
                <p className="text-xs text-gray-500">Email pengguna</p>
                <p className="mt-2 break-all text-sm text-gray-200">
                  {accountEmail || "Tidak tersedia"}
                </p>
              </div>
              <div className="mt-4">
                <p className="text-xs text-gray-500">Status akun</p>
                <p className="mt-2 text-sm text-emerald-400">
                  ● Login aktif
                </p>
              </div>
            </div>

            {/* DASHBOARD PREFERENCES */}
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-5">
              <h4 className="font-semibold">Preferensi Dashboard</h4>
              <label
                htmlFor="daily-target"
                className="mt-4 block text-sm text-gray-300"
              >
                Target produksi harian
              </label>
              <select
                id="daily-target"
                value={dailyTarget}
                onChange={(e) => handleDailyTargetChange(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b28] px-4 py-3 text-sm sm:max-w-xs"
              >
                {Array.from({ length: 20 }, (_, index) => index + 1).map(
                  (number) => (
                    <option key={number} value={number}>
                      {number} Video per hari
                    </option>
                  )
                )}
              </select>
              <p className="mt-3 text-xs text-gray-500">
                Target harian tersimpan di browser untuk akun yang sedang digunakan.
              </p>
            </div>

            {/* PUBLISHING PREFERENCES */}
            <div className="mt-4 rounded-xl border border-violet-500/20 bg-black/20 p-5">
              <div>
                <p className="text-sm text-violet-400">
                  PUBLISHING CONFIGURATION
                </p>
                <h4 className="mt-2 text-lg font-semibold">
                  Publishing Preferences
                </h4>
                <p className="mt-2 text-xs leading-5 text-gray-400">
                  Tentukan bagaimana CLIPFLOW AI akan mengatur tujuan publikasi video.
                </p>
              </div>

              {preferencesLoading ? (
                <p className="mt-5 text-sm text-gray-400">
                  Memuat pengaturan publikasi...
                </p>
              ) : (
                <>
                  <div className="mt-5 space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                      <input
                        type="radio"
                        name="publishing-mode"
                        value="auto"
                        checked={publishingMode === "auto"}
                        onChange={() => setPublishingMode("auto")}
                        className="mt-1 accent-violet-500"
                      />
                      <span>
                        <span className="block text-sm font-semibold">
                          Otomatis
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-gray-400">
                          Gunakan platform default yang dipilih untuk tujuan publikasi.
                        </span>
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                      <input
                        type="radio"
                        name="publishing-mode"
                        value="manual"
                        checked={publishingMode === "manual"}
                        onChange={() => setPublishingMode("manual")}
                        className="mt-1 accent-violet-500"
                      />
                      <span>
                        <span className="block text-sm font-semibold">
                          Manual
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-gray-400">
                          Simpan preferensi platform dan siapkan pilihan manual untuk setiap proyek.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="mt-6">
                    <h5 className="text-sm font-semibold">
                      Platform Default
                    </h5>
                    <p className="mt-2 text-xs leading-5 text-gray-400">
                      Pilihan ini digunakan sebagai tujuan default ketika mode otomatis aktif.
                    </p>

                    <div className="mt-4 space-y-3">
                      {socialPlatforms.map((platform) => (
                        <label
                          key={platform.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPlatforms.includes(platform.id)}
                            onChange={() => handlePlatformToggle(platform.id)}
                            className="h-4 w-4 accent-violet-500"
                          />
                          <span className={`text-xl ${platform.color}`}>
                            {platform.icon}
                          </span>
                          <span className="text-sm font-medium">
                            {platform.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="text-xs leading-5 text-blue-300">
                      Pengaturan ini disimpan berdasarkan akun Supabase.
                      Pilihan platform default terpisah dari pilihan platform
                      setiap proyek. Publikasi otomatis sungguhan belum aktif
                      sampai integrasi API resmi dan worker selesai dibuat.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    disabled={preferencesSaving}
                    className="mt-5 w-full rounded-xl bg-violet-600 px-5 py-4 text-sm font-bold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {preferencesSaving
                      ? "⏳ MENYIMPAN PENGATURAN..."
                      : "SIMPAN PENGATURAN PUBLIKASI"}
                  </button>
                </>
              )}
            </div>

            {/* LOGOUT */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div>
                <h4 className="font-semibold text-red-300">
                  Keluar dari akun
                </h4>
                <p className="mt-2 text-xs text-gray-400">
                  Akhiri sesi login CLIPFLOW AI.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
              >
                Logout
              </button>
            </div>
          </div>

          <footer className="mt-12 text-center text-xs text-gray-600">
            CLIPFLOW AI © 2026 · Automated Video Production Studio
          </footer>
        </section>
      </div>
    </main>
  );
}
