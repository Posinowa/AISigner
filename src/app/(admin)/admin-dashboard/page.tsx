// 🧭 Bu sayfa sadece admin kullanıcılar tarafından görülebilir.
// Amaç: Admin paneli için başlangıç noktası

"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  studentProfile?: {
    id: string;
    mentorId?: string | null;
  } | null;
};

type Mentor = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, mentorsRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/mentors")
        ]);

        const usersData = usersRes.ok ? await usersRes.json() : [];
        const mentorsData = mentorsRes.ok ? await mentorsRes.json() : [];

        setUsers(usersData);
        setMentors(mentorsData);
        
        console.log("Users loaded:", usersData.length);
        console.log("Mentors loaded:", mentorsData.length);
      } catch (err) {
        console.error("Fetch error:", err);
        setUsers([]);
        setMentors([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleRoleChange(userId: string, role: User["role"]) {
    setUpdating(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });

      if (response.ok) {
        setUsers(prev =>
          prev.map(u => (u.id === userId ? { ...u, role } : u))
        );
      } else {
        console.error("Failed to update role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      setUpdating(null);
    }
  }

  async function handleAssignMentor(studentId: string, mentorId: string) {
    setUpdating(studentId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          studentId, 
          mentorId: mentorId === "" ? null : mentorId // Boş string'i null'a çevir
        }),
      });

      if (response.ok) {
        setUsers(prev =>
          prev.map(u =>
            u.id === studentId && u.studentProfile
              ? { 
                  ...u, 
                  studentProfile: { 
                    ...u.studentProfile, 
                    mentorId: mentorId === "" ? null : mentorId 
                  } 
                }
              : u
          )
        );
        console.log(`Mentor assigned: Student ${studentId} -> Mentor ${mentorId}`);
      } else {
        console.error("Failed to assign mentor");
      }
    } catch (error) {
      console.error("Error assigning mentor:", error);
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return (
    <div className="p-6">
      <div className="flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mentor
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.name || user.lastName ? `${user.name || ''} ${user.lastName || ''}`.trim() : 'İsim belirtilmemiş'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <select
                    value={user.role}
                    onChange={e =>
                      handleRoleChange(user.id, e.target.value as User["role"])
                    }
                    disabled={updating === user.id}
                    className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ minWidth: '120px' }}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MENTOR">MENTOR</option>
                    <option value="STUDENT">STUDENT</option>
                  </select>
                  {updating === user.id && <span className="ml-2 text-xs text-blue-500">Updating...</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role === "STUDENT" && user.studentProfile ? (
                    <div className="flex flex-col">
                      <select
                        value={user.studentProfile.mentorId || ""}
                        onChange={e => {
                          console.log(`Changing mentor for student ${user.id} to ${e.target.value}`);
                          handleAssignMentor(user.id, e.target.value);
                        }}
                        disabled={updating === user.id}
                        className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        style={{ minWidth: '180px' }}
                      >
                        <option value="">Mentor Seçilmedi</option>
                        {mentors.map(mentor => (
                          <option key={mentor.id} value={mentor.id}>
                            {mentor.name || mentor.lastName 
                              ? `${mentor.name || ''} ${mentor.lastName || ''}`.trim()
                              : mentor.email
                            }
                          </option>
                        ))}
                      </select>
                      {updating === user.id && <span className="text-xs text-blue-500 mt-1">Updating...</span>}
                      {user.studentProfile.mentorId && (
                        <span className="text-xs text-gray-400 mt-1">
                          Current: {mentors.find(m => m.id === user.studentProfile?.mentorId)?.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">
                      {user.role === "STUDENT" ? "No Student Profile" : "Not Student"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {users.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </div>
      
      {/* Debug Info */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold mb-2">Debug Info:</h3>
        <p>Total Users: {users.length}</p>
        <p>Total Mentors: {mentors.length}</p>
        <p>Students with Profile: {users.filter(u => u.role === "STUDENT" && u.studentProfile).length}</p>
      </div>
    </div>
  );
}
