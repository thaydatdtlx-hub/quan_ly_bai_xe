"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Vehicle = {
  id: number;
  slot: string;
  plate: string;
  driverName: string;
  phone: string;
  vehicleType: string;
  monthlyFee: number;
  monthPaid: boolean;
  washCredits: number;
  createdAt: string;
};

type Wash = {
  id: number;
  plate: string;
  workItem: string;
  price: number;
  discount: number;
  finalAmount: number;
  usedCredit: boolean;
  createdByName: string;
  createdAt: string;
};

type Service = {
  id: number;
  plate: string;
  serviceName: string;
  price: number;
  discount: number;
  finalAmount: number;
  bonusWashes: number;
  note: string;
  createdAt: string;
};

type Payment = {
  id: number;
  plate: string;
  amount: number;
  paymentType: string;
  createdAt: string;
};

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  createdByName: string;
  isRead: boolean;
  createdAt: string;
};

type Session = {
  userId: string;
  email: string;
  fullName: string;
  role: "admin" | "staff_wash";
};

type Data = {
  vehicles: Vehicle[];
  washes: Wash[];
  services: Service[];
  payments: Payment[];
  notifications: Notification[];
  session?: Session;
};
type View = "overview" | "vehicles" | "washes" | "services" | "finance";
type Modal = "vehicle" | "wash" | "payment" | "service" | null;

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + "đ";
const time = (value: string) => new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN");
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const monthKey = (value: string) => {
  const item = new Date(value);
  return `${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, "0")}`;
};
const safeCell = (value: string) => /^[=+\-@]/.test(value) ? `'${value}` : value;

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Tổng quan", icon: "▦" },
  { id: "vehicles", label: "Xe trong bãi", icon: "▰" },
  { id: "washes", label: "Rửa xe", icon: "♨" },
  { id: "services", label: "Dịch vụ", icon: "▣" },
  { id: "finance", label: "Thu chi", icon: "₫" },
];

const initialData: Data = { vehicles: [], washes: [], services: [], payments: [], notifications: [] };

export default function ParkingManager() {
  const [data, setData] = useState<Data>(initialData);
  const [view, setView] = useState<View>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationReadAt, setNotificationReadAt] = useState("");
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/parking", { cache: "no-store" });
      const result = await response.json() as Data & { error?: string };
      if (response.status === 401 || result.error?.includes("Chưa cấu hình đầy đủ")) {
        setData(initialData);
        setModal(null);
        setAuthRequired(true);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Không tải được dữ liệu.");
      setData(result);
      setAuthRequired(false);
      if (result.session?.role === "staff_wash") setView("washes");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/parking", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as Data & { error?: string };
        if (response.status === 401 || result.error?.includes("Chưa cấu hình đầy đủ")) {
          if (active) setAuthRequired(true);
          return;
        }
        if (!response.ok) throw new Error(result.error || "Không tải được dữ liệu.");
        if (active) {
          setData(result);
          if (result.session?.role === "staff_wash") setView("washes");
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotificationReadAt(localStorage.getItem("parking_notifications_read_at") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (data.session?.role !== "admin") return;
    const timer = window.setInterval(() => {
      fetch("/api/parking", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<Data>;
        })
        .then((result) => {
          if (result?.session?.role === "admin") setData(result);
        })
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [data.session?.role]);

  async function submit(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (response.status === 401) {
        setAuthRequired(true);
        setModal(null);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Không thể lưu dữ liệu.");
      setModal(null);
      setEditingVehicle(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    if (!query) return data.vehicles;
    return data.vehicles.filter((vehicle) =>
      [vehicle.plate, vehicle.driverName, vehicle.phone, vehicle.slot].some((value) =>
        value.toLocaleLowerCase("vi").includes(query)
      )
    );
  }, [data.vehicles, search]);

  const filteredData = useMemo<Data>(() => {
    const keep = (createdAt: string) => !monthFilter || monthKey(createdAt) === monthFilter;
    return {
      ...data,
      washes: data.washes.filter((item) => keep(item.createdAt)),
      services: data.services.filter((item) => keep(item.createdAt)),
      payments: data.payments.filter((item) => keep(item.createdAt)),
    };
  }, [data, monthFilter]);

  const unpaid = data.vehicles.filter((vehicle) => !vehicle.monthPaid);
  const totalIncome =
    filteredData.washes.reduce((sum, item) => sum + item.finalAmount, 0) +
    filteredData.services.reduce((sum, item) => sum + item.finalAmount, 0) +
    filteredData.payments.reduce((sum, item) => sum + item.amount, 0);
  const washesToday = filteredData.washes.filter((item) => date(item.createdAt) === date(new Date().toISOString())).length;
  const isAdmin = data.session?.role === "admin";
  const visibleNotifications = useMemo(
    () => data.notifications.map((item) => ({
      ...item,
      isRead: item.isRead || Boolean(notificationReadAt && item.createdAt <= notificationReadAt),
    })),
    [data.notifications, notificationReadAt],
  );
  const unreadNotifications = visibleNotifications.filter((item) => !item.isRead).length;
  const visibleNavItems = isAdmin ? navItems : navItems.filter((item) => item.id === "washes");
  const accountInitial = data.session?.fullName.trim().charAt(0).toLocaleUpperCase("vi") || "U";

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    setData(initialData);
    setModal(null);
    setView("overview");
    setAuthRequired(true);
  }

  function markNotificationsRead() {
    const readAt = new Date().toISOString();
    setNotificationReadAt(readAt);
    localStorage.setItem("parking_notifications_read_at", readAt);
    void fetch("/api/parking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markNotificationsRead" }),
    });
  }

  async function exportData() {
    if (!isAdmin || exporting) return;
    setExporting(true);
    setError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const addSheet = (name: string, rows: Record<string, string | number>[], widths: number[]) => {
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = widths.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };
      addSheet("Tổng quan", [
        { "Chỉ số": "Tháng dữ liệu", "Giá trị": monthFilter || "Tất cả" },
        { "Chỉ số": "Tổng xe trong bãi", "Giá trị": data.vehicles.length },
        { "Chỉ số": "Xe chưa đóng tháng", "Giá trị": unpaid.length },
        { "Chỉ số": "Số lượt rửa", "Giá trị": filteredData.washes.length },
        { "Chỉ số": "Tổng doanh thu", "Giá trị": totalIncome },
      ], [28, 22]);
      addSheet("Xe trong bãi", data.vehicles.map((item) => ({
        "Ô đỗ": safeCell(item.slot),
        "Biển số": safeCell(item.plate),
        "CHỦ XE": safeCell(item.driverName),
        "Số điện thoại": safeCell(item.phone),
        "Loại xe": safeCell(item.vehicleType),
        "Tiền tháng": item.monthlyFee,
        "Đã đóng": item.monthPaid ? "Có" : "Chưa",
        "Lượt rửa còn": item.washCredits,
        "Ngày vào": date(item.createdAt),
      })), [12, 18, 24, 18, 15, 16, 12, 15, 14]);
      addSheet("Lượt rửa", filteredData.washes.map((item) => ({
        "Ngày": date(item.createdAt),
        "Giờ": time(item.createdAt),
        "Biển số": safeCell(item.plate),
        "Hạng mục": safeCell(item.workItem),
        "Giá": item.price,
        "Giảm giá": item.discount,
        "Thành tiền": item.finalAmount,
        "Dùng lượt tặng": item.usedCredit ? "Có" : "Không",
        "Người nhập": safeCell(item.createdByName || "Không xác định"),
      })), [14, 10, 18, 24, 15, 15, 16, 16, 24]);
      addSheet("Dịch vụ", filteredData.services.map((item) => ({
        "Ngày": date(item.createdAt),
        "Biển số": safeCell(item.plate),
        "Dịch vụ": safeCell(item.serviceName),
        "Giá": item.price,
        "Giảm giá": item.discount,
        "Thành tiền": item.finalAmount,
        "Lượt rửa tặng": item.bonusWashes,
        "Ghi chú": safeCell(item.note),
      })), [14, 18, 28, 15, 15, 16, 16, 32]);
      addSheet("Thanh toán", filteredData.payments.map((item) => ({
        "Ngày": date(item.createdAt),
        "Giờ": time(item.createdAt),
        "Biển số": safeCell(item.plate),
        "Loại thanh toán": safeCell(item.paymentType),
        "Số tiền": item.amount,
      })), [14, 10, 18, 24, 18]);
      XLSX.writeFile(workbook, `bai-xe-minh-phuc-${monthFilter || "tat-ca"}.xlsx`, { compression: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất file Excel.");
    } finally {
      setExporting(false);
    }
  }

  if (authRequired) {
    return <LoginScreen onSuccess={() => {
      setAuthRequired(false);
      void load();
    }} />;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => setView(isAdmin ? "overview" : "washes")} aria-label={isAdmin ? "Về trang tổng quan" : "Về nhật ký rửa xe"}>
          <span className="brand-mark">P</span>
          <strong>BÃI XE MINH PHÚC</strong>
        </button>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {visibleNavItems.map((item) => (
            <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="icon-button" onClick={() => void load()} aria-label="Tải lại dữ liệu">↻</button>
          {isAdmin && (
            <div className="notification-wrap">
              <button
                className={notificationOpen ? "icon-button notification-button active" : "icon-button notification-button"}
                onClick={() => setNotificationOpen((current) => !current)}
                aria-label={`Thông báo, ${unreadNotifications} chưa đọc`}
                aria-expanded={notificationOpen}
              >
                🔔
                {unreadNotifications > 0 && <span>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
              </button>
              {notificationOpen && (
                <NotificationPanel
                  notifications={visibleNotifications}
                  saving={saving}
                  onClose={() => setNotificationOpen(false)}
                  onMarkAll={markNotificationsRead}
                />
              )}
            </div>
          )}
          <div className="account-block">
            <div className="avatar" aria-label={`Tài khoản ${data.session?.fullName}`}>{accountInitial}</div>
            <span><strong>{data.session?.fullName}</strong><small>{isAdmin ? "Quản trị viên" : "Nhân viên rửa xe"}</small></span>
          </div>
          <button className="logout-button" onClick={() => void logout()}>Đăng xuất</button>
          {isAdmin && <button className="header-primary" onClick={() => { setEditingVehicle(null); setModal("vehicle"); }}><span>＋</span> Thêm xe mới</button>}
        </div>
      </header>

      <main className="main">
        {view !== "overview" && (
          <header className="topbar">
            <div>
              <p className="eyebrow">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "long" })}</p>
              <h1>{navItems.find((item) => item.id === view)?.label}</h1>
            </div>
          </header>
        )}

        {isAdmin && (
          <section className="data-controls" aria-label="Bộ lọc và xuất dữ liệu">
            <div>
              <label htmlFor="month-filter">Lọc dữ liệu theo tháng</label>
              <input id="month-filter" type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} />
              <button type="button" onClick={() => setMonthFilter("")} className={!monthFilter ? "active" : ""}>Tất cả thời gian</button>
            </div>
            <span>{monthFilter ? `Đang xem tháng ${monthFilter.slice(5)}/${monthFilter.slice(0, 4)}` : "Đang xem toàn bộ dữ liệu"}</span>
            <button className="export-button" type="button" disabled={exporting} onClick={() => void exportData()}>
              {exporting ? "ĐANG XUẤT…" : "⇩ XUẤT DATA (.XLSX)"}
            </button>
          </section>
        )}

        {error && <div className="alert" role="alert"><span>!</span><p>{error}</p><button onClick={() => setError("")}>×</button></div>}
        {loading ? <LoadingState /> : (
          <>
            {isAdmin && view === "overview" && (
              <Overview
                data={filteredData}
                unpaid={unpaid}
                washesToday={washesToday}
                totalIncome={totalIncome}
                setView={setView}
                openModal={setModal}
              />
            )}
            {isAdmin && view === "vehicles" && (
              <VehiclesView
                vehicles={filteredVehicles}
                search={search}
                setSearch={setSearch}
                onAdd={() => { setEditingVehicle(null); setModal("vehicle"); }}
                onCollect={(id) => { sessionStorage.setItem("selectedVehicle", String(id)); setModal("payment"); }}
                togglePaid={(vehicle) => void submit({ action: "togglePaid", vehicleId: vehicle.id, monthPaid: !vehicle.monthPaid })}
                onEdit={(vehicle) => { setEditingVehicle(vehicle); setModal("vehicle"); }}
                onDelete={(vehicle) => {
                  const confirmed = window.confirm(
                    `Xóa xe ${vehicle.plate} khỏi danh sách bãi? Lịch sử rửa, dịch vụ và thanh toán vẫn được giữ lại.`
                  );
                  if (confirmed) void submit({ action: "deleteVehicle", vehicleId: vehicle.id });
                }}
                deleting={saving}
              />
            )}
            {view === "washes" && (
              <WashesView
                washes={isAdmin ? filteredData.washes : data.washes}
                onAdd={() => setModal("wash")}
                canDelete={isAdmin}
                deleting={saving}
                onDelete={(wash) => {
                  const confirmed = window.confirm(
                    `Xóa lượt rửa ${wash.workItem} của xe ${wash.plate}? Hành động này không thể hoàn tác.`
                  );
                  if (confirmed) void submit({ action: "deleteWash", washId: wash.id });
                }}
              />
            )}
            {isAdmin && view === "services" && <ServicesView services={filteredData.services} onAdd={() => setModal("service")} />}
            {isAdmin && view === "finance" && <FinanceView data={filteredData} total={totalIncome} />}
          </>
        )}
      </main>

      <nav className={isAdmin ? "mobile-nav" : "mobile-nav staff"} aria-label="Điều hướng trên điện thoại">
        {visibleNavItems.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
            <span>{item.icon}</span><small>{item.label.replace(" trong bãi", "")}</small>
          </button>
        ))}
      </nav>

      {modal && (isAdmin || modal === "wash") && (
        <ModalShell title={modal === "vehicle" && editingVehicle ? "Chỉnh sửa thông tin xe" : { vehicle: "Thêm xe vào bãi", wash: "Ghi lượt rửa xe", payment: "Thu tiền tháng", service: "Thêm dịch vụ thuê" }[modal]} onClose={() => { setModal(null); setEditingVehicle(null); }}>
          {modal === "vehicle" && <VehicleForm vehicle={editingVehicle} saving={saving} onSubmit={submit} />}
          {modal === "wash" && <WashForm vehicles={data.vehicles} saving={saving} onSubmit={submit} />}
          {modal === "payment" && <PaymentForm vehicles={data.vehicles} saving={saving} onSubmit={submit} />}
          {modal === "service" && <ServiceForm vehicles={data.vehicles} saving={saving} onSubmit={submit} />}
        </ModalShell>
      )}
    </div>
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Đăng nhập không thành công.");
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập không thành công.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark">P</span><div><strong>BÃI XE MINH PHÚC</strong><small>Vận hành nhanh, dữ liệu tập trung</small></div></div>
        <div className="login-heading"><span>ĐĂNG NHẬP HỆ THỐNG</span><h1>Chào mừng trở lại</h1><p>Nhập tài khoản do quản trị viên cấp để tiếp tục.</p></div>
        {error && <div className="login-error" role="alert">! <span>{error}</span></div>}
        <form className="login-form" onSubmit={login}>
          <label><span>Tên đăng nhập</span><input name="username" autoComplete="username" placeholder="Ví dụ: admin" required autoFocus /></label>
          <label><span>Mật khẩu</span><input name="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required /></label>
          <button type="submit" disabled={submitting}>{submitting ? "Đang đăng nhập…" : "Đăng nhập"}</button>
        </form>
        <p className="login-help">Admin quản lý toàn bộ hệ thống. Nhân viên chỉ được xem danh sách xe cần thiết và nhập lượt rửa xe.</p>
      </section>
      <aside className="login-visual" aria-hidden="true">
        <span>VẬN HÀNH BÃI XE</span>
        <h2>Mọi lượt xe, khoản thu và dịch vụ trong một nơi.</h2>
        <div className="login-stat-grid"><div><strong>01</strong><small>Admin toàn quyền</small></div><div><strong>02</strong><small>Nhân viên rửa xe</small></div></div>
      </aside>
    </main>
  );
}

function LoadingState() {
  return <div className="loading-grid" aria-label="Đang tải dữ liệu">{Array.from({ length: 8 }).map((_, index) => <div key={index} />)}</div>;
}

function NotificationPanel({ notifications, saving, onClose, onMarkAll }: {
  notifications: Notification[];
  saving: boolean;
  onClose: () => void;
  onMarkAll: () => void;
}) {
  return (
    <section className="notification-panel" aria-label="Trung tâm thông báo">
      <header>
        <div><small>TRUNG TÂM THÔNG BÁO</small><strong>Hoạt động nhân viên</strong></div>
        <button type="button" onClick={onClose} aria-label="Đóng thông báo">×</button>
      </header>
      <div className="notification-list">
        {notifications.map((item) => (
          <article className={item.isRead ? "notification-item" : "notification-item unread"} key={item.id}>
            <span className="notification-dot" />
            <div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <small>{date(item.createdAt)} · {time(item.createdAt)}</small>
            </div>
          </article>
        ))}
        {!notifications.length && <Empty text="Chưa có hoạt động mới từ nhân viên." />}
      </div>
      {notifications.some((item) => !item.isRead) && (
        <footer><button type="button" disabled={saving} onClick={onMarkAll}>{saving ? "Đang cập nhật…" : "Đánh dấu tất cả đã đọc"}</button></footer>
      )}
    </section>
  );
}

function Overview({ data, unpaid, washesToday, totalIncome, setView, openModal }: {
  data: Data; unpaid: Vehicle[]; washesToday: number; totalIncome: number; setView: (view: View) => void; openModal: (modal: Modal) => void;
}) {
  const occupied = data.vehicles.length;
  const paid = Math.max(0, occupied - unpaid.length);
  return (
    <>
      <section className="metrics" aria-label="Số liệu tổng quan">
        <Metric icon="▰" value={occupied} label="Tổng xe" tone="blue" />
        <Metric icon="✓" value={paid} label="Đã đóng tháng" tone="cyan" />
        <Metric icon="!" value={unpaid.length} label="Chưa đóng" tone="orange" />
        <Metric icon="↗" value={money(totalIncome).replace("đ", "")} label="Doanh thu tháng" tone="revenue" />
      </section>

      <section className="quick-actions" aria-label="Thao tác nhanh">
        <button onClick={() => openModal("vehicle")}><span>＋</span>Thêm xe</button>
        <button onClick={() => openModal("wash")}><span>♨</span>Ghi lượt rửa</button>
        <button className="dark" onClick={() => openModal("payment")}><span>₫</span>Thu tiền tháng</button>
        <button className="soft" onClick={() => openModal("service")}><span>▣</span>Thêm dịch vụ</button>
      </section>

      <section className="overview-grid">
        <Card title="Xe gần đây" icon="◷" action="Xem tất cả" onAction={() => setView("vehicles")}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ô</th><th>Biển số</th><th>CHỦ XE</th><th>Điện thoại</th><th>Tiền tháng</th><th>Trạng thái</th></tr></thead>
              <tbody>{data.vehicles.slice(0, 5).map((vehicle) => (
                <tr key={vehicle.id}>
                  <td><span className="slot">{vehicle.slot}</span></td>
                  <td><strong>{vehicle.plate}</strong></td>
                  <td>{vehicle.driverName}</td>
                  <td>{vehicle.phone}</td>
                  <td>{money(vehicle.monthlyFee)}</td>
                  <td><PaidBadge paid={vehicle.monthPaid} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>

        <Card title={`Hoạt động rửa xe · ${washesToday} lượt hôm nay`} icon="♨" action="Xem tất cả" onAction={() => setView("washes")}>
          <div className="activity-list">
            {data.washes.slice(0, 5).map((wash) => (
              <div className="activity-row" key={wash.id}>
                <span className="activity-time">{time(wash.createdAt)}</span>
                <span><strong>{wash.plate}</strong><small>{wash.workItem}</small></span>
                <span><small>{wash.usedCredit ? "Dùng lượt miễn phí" : wash.discount ? `Giảm ${money(wash.discount)}` : "Không giảm giá"}</small><strong className="amount">{money(wash.finalAmount)}</strong></span>
              </div>
            ))}
            {!data.washes.length && <Empty text="Chưa có lượt rửa nào." />}
          </div>
        </Card>
      </section>

      <section className="work-panel">
        <div className="panel-handle" />
        <div className="work-summary">
          <div className="work-title"><span>✓</span><div><strong>Công việc cần xử lý</strong><small>Để bãi xe luôn vận hành trơn tru</small></div></div>
          <div className="task warning"><span>□</span><div><strong>{unpaid.length} xe chưa đóng tháng</strong><small>Tổng nợ {money(unpaid.reduce((sum, item) => sum + item.monthlyFee, 0))}</small></div><button onClick={() => setView("vehicles")}>Xem danh sách ›</button></div>
          <div className="task"><span>♨</span><div><strong>{data.vehicles.reduce((sum, item) => sum + item.washCredits, 0)} lượt rửa còn lại</strong><small>Đã tặng cho xe tại bãi</small></div><button onClick={() => setView("vehicles")}>Chi tiết ›</button></div>
        </div>
        <div className="income-card">
          <small>Tổng thu đã ghi nhận</small>
          <strong>{money(totalIncome)}</strong>
          <button onClick={() => setView("finance")}>Xem thu chi</button>
        </div>
      </section>
    </>
  );
}

function Metric({ icon, value, label, tone }: { icon: string; value: number | string; label: string; tone: string }) {
  return <article className={`metric ${tone}`}><span className="metric-icon">{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>;
}

function Card({ title, icon, action, onAction, children }: { title: string; icon: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return <article className="card"><header><div><span>{icon}</span><h2>{title}</h2></div><button onClick={onAction}>{action} →</button></header>{children}</article>;
}

function PaidBadge({ paid }: { paid: boolean }) {
  return <span className={paid ? "badge paid" : "badge unpaid"}>{paid ? "Đã đóng" : "Chưa đóng"}</span>;
}

function PageHeading({ eyebrow, title, description, action, actionLabel }: { eyebrow: string; title: string; description: string; action?: () => void; actionLabel?: string }) {
  return <div className="page-heading"><div><small>{eyebrow}</small><h2>{title}</h2><p>{description}</p></div>{action && <button className="primary-button" onClick={action}>＋ {actionLabel}</button>}</div>;
}

function VehiclesView({ vehicles, search, setSearch, onAdd, onCollect, togglePaid, onEdit, onDelete, deleting }: {
  vehicles: Vehicle[];
  search: string;
  setSearch: (value: string) => void;
  onAdd: () => void;
  onCollect: (id: number) => void;
  togglePaid: (vehicle: Vehicle) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
  deleting: boolean;
}) {
  return (
    <section className="page-section">
      <PageHeading eyebrow="QUẢN LÝ CHỖ ĐỖ" title={`${vehicles.length} xe trong bãi`} description="Theo dõi ô đỗ, thông tin chủ xe, tiền tháng và lượt rửa còn lại." action={onAdd} actionLabel="Thêm xe" />
      <div className="toolbar"><label><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm biển số, tên, số điện thoại hoặc ô đỗ…" /></label></div>
      <div className="vehicle-grid">
        {vehicles.map((vehicle) => (
          <article className="vehicle-card" key={vehicle.id}>
            <header><span className="slot large">{vehicle.slot}</span><PaidBadge paid={vehicle.monthPaid} /></header>
            <h3>{vehicle.plate}</h3><p>{vehicle.vehicleType} · {vehicle.driverName}</p>
            <dl>
              <div><dt>Số điện thoại</dt><dd>{vehicle.phone}</dd></div>
              <div><dt>Tiền tháng</dt><dd>{money(vehicle.monthlyFee)}</dd></div>
              <div><dt>Lượt rửa còn</dt><dd className="wash-credit">{vehicle.washCredits} lượt</dd></div>
            </dl>
            <footer>
              {!vehicle.monthPaid && <button className="collect" onClick={() => onCollect(vehicle.id)}>Thu tiền</button>}
              <button onClick={() => togglePaid(vehicle)}>{vehicle.monthPaid ? "Đánh dấu chưa đóng" : "Đánh dấu đã đóng"}</button>
            </footer>
            <div className="vehicle-admin-actions">
              <button type="button" onClick={() => onEdit(vehicle)}>✎ Chỉnh sửa</button>
              <button className="danger" type="button" disabled={deleting} onClick={() => onDelete(vehicle)}>× Xóa xe</button>
            </div>
          </article>
        ))}
        {!vehicles.length && <Empty text="Không tìm thấy xe phù hợp." />}
      </div>
    </section>
  );
}

function WashesView({ washes, onAdd, canDelete, deleting, onDelete }: {
  washes: Wash[];
  onAdd: () => void;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (wash: Wash) => void;
}) {
  return (
    <section className="page-section">
      <PageHeading eyebrow="NHẬT KÝ CÔNG VIỆC" title="Lượt rửa xe" description="Theo dõi hạng mục, giá gốc, giảm giá và số tiền thực thu." action={onAdd} actionLabel="Ghi lượt rửa" />
      <div className="detail-card">
        <div className="table-wrap">
          <table><thead><tr><th>Ngày giờ</th><th>Biển số</th><th>Hạng mục</th><th>Người nhập</th><th>Giá</th><th>Giảm giá</th><th>Thành tiền</th>{canDelete && <th>Thao tác</th>}</tr></thead>
            <tbody>{washes.map((item) => (
              <tr key={item.id}>
                <td>{date(item.createdAt)} · {time(item.createdAt)}</td>
                <td><strong>{item.plate}</strong></td>
                <td>{item.workItem}{item.usedCredit && <span className="mini-note">Dùng lượt tặng</span>}</td>
                <td>{item.createdByName || "Không xác định"}</td>
                <td>{money(item.price)}</td>
                <td>{money(item.discount)}</td>
                <td><strong className="amount">{money(item.finalAmount)}</strong></td>
                {canDelete && <td><button className="delete-button" type="button" disabled={deleting} onClick={() => onDelete(item)}>Xóa</button></td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
        {!washes.length && <Empty text="Chưa có lượt rửa nào." />}
      </div>
    </section>
  );
}

function ServicesView({ services, onAdd }: { services: Service[]; onAdd: () => void }) {
  return (
    <section className="page-section">
      <PageHeading eyebrow="DỊCH VỤ THUÊ" title="Dịch vụ cho xe" description="Quản lý tiền dịch vụ, chiết khấu, giảm giá và lượt rửa tặng kèm." action={onAdd} actionLabel="Thêm dịch vụ" />
      <div className="service-grid">
        {services.map((item) => <article className="service-card" key={item.id}><header><span>▣</span><small>{date(item.createdAt)}</small></header><h3>{item.serviceName}</h3><p>{item.plate}</p><dl><div><dt>Giá dịch vụ</dt><dd>{money(item.price)}</dd></div><div><dt>Chiết khấu</dt><dd>-{money(item.discount)}</dd></div><div className="total"><dt>Thực thu</dt><dd>{money(item.finalAmount)}</dd></div></dl>{item.bonusWashes > 0 && <div className="bonus">＋ Tặng {item.bonusWashes} lượt rửa</div>}{item.note && <small className="note">{item.note}</small>}</article>)}
        {!services.length && <Empty text="Chưa có dịch vụ thuê nào. Hãy thêm dịch vụ đầu tiên." />}
      </div>
    </section>
  );
}

function FinanceView({ data, total }: { data: Data; total: number }) {
  const rows = [
    ...data.payments.map((item) => ({ id: `p${item.id}`, time: item.createdAt, plate: item.plate, type: item.paymentType, amount: item.amount })),
    ...data.washes.map((item) => ({ id: `w${item.id}`, time: item.createdAt, plate: item.plate, type: item.workItem, amount: item.finalAmount })),
    ...data.services.map((item) => ({ id: `s${item.id}`, time: item.createdAt, plate: item.plate, type: item.serviceName, amount: item.finalAmount })),
  ].sort((a, b) => b.time.localeCompare(a.time));
  return (
    <section className="page-section">
      <PageHeading eyebrow="DÒNG TIỀN" title="Thu chi tại bãi" description="Tổng hợp tiền tháng, rửa xe và dịch vụ đã ghi nhận." />
      <div className="finance-hero"><div><small>Tổng doanh thu</small><strong>{money(total)}</strong></div><span>↗ Đang cập nhật theo dữ liệu thực tế</span></div>
      <div className="detail-card"><div className="table-wrap"><table><thead><tr><th>Ngày giờ</th><th>Biển số</th><th>Nội dung</th><th>Số tiền</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td>{date(item.time)} · {time(item.time)}</td><td><strong>{item.plate}</strong></td><td>{item.type}</td><td><strong className="amount">＋{money(item.amount)}</strong></td></tr>)}</tbody></table></div>{!rows.length && <Empty text="Chưa có khoản thu nào." />}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><span>☷</span><p>{text}</p></div>;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-handle" /><header><div><small>GHI NHẬN NHANH</small><h2>{title}</h2></div><button onClick={onClose} aria-label="Đóng">×</button></header>{children}</section></div>;
}

function VehicleForm({ vehicle, saving, onSubmit }: { vehicle: Vehicle | null; saving: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void onSubmit({ action: vehicle ? "updateVehicle" : "addVehicle", vehicleId: vehicle?.id, slot: form.get("slot"), plate: form.get("plate"), driverName: form.get("driverName"), phone: form.get("phone"), vehicleType: form.get("vehicleType"), monthlyFee: form.get("monthlyFee"), washCredits: form.get("washCredits"), monthPaid: form.get("monthPaid") === "on" });
  }
  return <form onSubmit={handle} className="form-grid"><Field label="Ô đỗ" name="slot" placeholder="A01" defaultValue={vehicle?.slot} required /><Field label="Biển số xe" name="plate" placeholder="51H-123.45" defaultValue={vehicle?.plate} required /><Field label="CHỦ XE" name="driverName" placeholder="Nguyễn Văn A" defaultValue={vehicle?.driverName} required /><Field label="Số điện thoại" name="phone" placeholder="0901 234 567" defaultValue={vehicle?.phone} required /><SelectField label="Loại xe" name="vehicleType" options={["Ô tô", "Xe máy", "Xe tải", "Xe khách"]} defaultValue={vehicle?.vehicleType} /><Field label="Tiền gửi mỗi tháng" name="monthlyFee" type="number" defaultValue={String(vehicle?.monthlyFee ?? 1200000)} required /><Field label="Số lượt rửa có sẵn" name="washCredits" type="number" defaultValue={String(vehicle?.washCredits ?? 0)} /><label className="check-field"><input type="checkbox" name="monthPaid" defaultChecked={vehicle?.monthPaid} /><span>Xe đã đóng tiền tháng này</span></label><SubmitButton saving={saving} label={vehicle ? "Lưu thay đổi" : "Lưu xe vào bãi"} /></form>;
}

function WashForm({ vehicles, saving, onSubmit }: { vehicles: Vehicle[]; saving: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? 0);
  const [workItem, setWorkItem] = useState("Rửa thường");
  const [price, setPrice] = useState(50000);
  const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const prices: Record<string, number> = { "Rửa thường": 50000, "Rửa + hút bụi": 70000, "Rửa + Wax": 80000, "Vệ sinh nội thất": 120000 };
  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (!selected) return;
    void onSubmit({ action: "recordWash", vehicleId, plate: selected.plate, workItem, price, discount: form.get("discount"), usedCredit: form.get("usedCredit") === "on" });
  }
  return <form onSubmit={handle} className="form-grid"><label className="field full"><span>Chọn xe tại bãi</span><select value={vehicleId} onChange={(event) => setVehicleId(Number(event.target.value))}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.driverName}</option>)}</select></label><label className="field"><span>Hạng mục công việc</span><select value={workItem} onChange={(event) => { setWorkItem(event.target.value); setPrice(prices[event.target.value] ?? 0); }}>{Object.keys(prices).map((item) => <option key={item}>{item}</option>)}</select></label><Field label="Giá" name="price" type="number" value={price} onChange={(value) => setPrice(Number(value))} /><Field label="Giảm giá" name="discount" type="number" defaultValue="0" /><label className="check-field full"><input type="checkbox" name="usedCredit" disabled={!selected?.washCredits} /><span>Dùng 1 lượt rửa miễn phí {selected ? `(còn ${selected.washCredits} lượt)` : ""}</span></label><SubmitButton saving={saving} label="Ghi nhận lượt rửa" /></form>;
}

function PaymentForm({ vehicles, saving, onSubmit }: { vehicles: Vehicle[]; saving: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const stored = typeof window !== "undefined" ? Number(sessionStorage.getItem("selectedVehicle")) : 0;
  const [vehicleId, setVehicleId] = useState(stored || vehicles.find((vehicle) => !vehicle.monthPaid)?.id || vehicles[0]?.id || 0);
  const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void onSubmit({ action: "collectPayment", vehicleId, amount: form.get("amount"), note: form.get("note") });
  }
  return <form onSubmit={handle} className="form-grid"><label className="field full"><span>Chọn xe cần thu</span><select value={vehicleId} onChange={(event) => setVehicleId(Number(event.target.value))}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.driverName} {vehicle.monthPaid ? "(đã đóng)" : "(chưa đóng)"}</option>)}</select></label><Field label="Số tiền" name="amount" type="number" key={selected?.id} defaultValue={String(selected?.monthlyFee ?? 0)} required /><Field label="Ghi chú" name="note" placeholder="Tiền tháng hiện tại" /><div className="payment-preview full"><span>Xe sẽ được chuyển sang trạng thái</span><PaidBadge paid /></div><SubmitButton saving={saving} label="Xác nhận đã thu" /></form>;
}

function ServiceForm({ vehicles, saving, onSubmit }: { vehicles: Vehicle[]; saving: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? 0);
  const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void onSubmit({ action: "addService", vehicleId, plate: selected?.plate, serviceName: form.get("serviceName"), price: form.get("price"), discount: form.get("discount"), bonusWashes: form.get("bonusWashes"), note: form.get("note") });
  }
  return <form onSubmit={handle} className="form-grid"><label className="field full"><span>Xe sử dụng dịch vụ</span><select value={vehicleId} onChange={(event) => setVehicleId(Number(event.target.value))}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.driverName}</option>)}</select></label><Field label="Tên dịch vụ" name="serviceName" placeholder="Ví dụ: Thuê tài xế đưa xe đi đăng kiểm" required /><Field label="Giá dịch vụ" name="price" type="number" defaultValue="500000" required /><Field label="Chiết khấu / giảm giá" name="discount" type="number" defaultValue="0" /><Field label="Tặng số lượt rửa" name="bonusWashes" type="number" defaultValue="0" /><Field label="Ghi chú" name="note" placeholder="Thông tin thêm…" className="full" /><SubmitButton saving={saving} label="Lưu dịch vụ" /></form>;
}

function Field({ label, name, type = "text", placeholder, defaultValue, required, className = "", value, onChange }: { label: string; name: string; type?: string; placeholder?: string; defaultValue?: string; required?: boolean; className?: string; value?: string | number; onChange?: (value: string) => void }) {
  return <label className={`field ${className}`}><span>{label}</span><input name={name} type={type} placeholder={placeholder} defaultValue={value === undefined ? defaultValue : undefined} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} required={required} min={type === "number" ? 0 : undefined} /></label>;
}

function SelectField({ label, name, options, defaultValue }: { label: string; name: string; options: string[]; defaultValue?: string }) {
  return <label className="field"><span>{label}</span><select name={name} defaultValue={defaultValue}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function SubmitButton({ saving, label }: { saving: boolean; label: string }) {
  return <button className="submit-button full" type="submit" disabled={saving}>{saving ? "Đang lưu…" : label}</button>;
}
