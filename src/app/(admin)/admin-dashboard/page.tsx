// 🧭 Bu sayfa sadece admin kullanıcılar tarafından görülebilir.
// Amaç: Admin paneli için başlangıç noktası

export default function AdminDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-gray-600">Yalnızca admin rolüne sahip kullanıcılar buraya erişebilir.</p>
    </div>
  )
}
