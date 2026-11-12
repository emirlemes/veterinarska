"use client";

import { useState, type FormEvent } from "react";

const roleOptions = [
  ["ADMIN", "Admin"],
  ["VETERINARIAN", "Veterinar"],
] as const;

type EmployeeRole = (typeof roleOptions)[number][0];

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: EmployeeRole;
  isActive: boolean;
  createdAt: string;
};

const blankDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  role: "VETERINARIAN" as EmployeeRole,
};

function getErrorMessage(value: unknown) {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return "Nije moguće sačuvati korisnički nalog.";
}

function roleName(role: EmployeeRole) {
  return roleOptions.find(([value]) => value === role)?.[1] ?? role;
}

export function EmployeeManager({
  employees: initialEmployees,
  currentUserId,
}: {
  employees: Employee[];
  currentUserId: string;
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blankDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function startEditing(employee: Employee) {
    setEditingId(employee.id);
    setDraft({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone ?? "",
      password: "",
      role: employee.role,
    });
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setDraft(blankDraft);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const payload = {
        ...draft,
        ...(editingId && !draft.password ? { password: undefined } : {}),
      };
      const response = await fetch(editingId ? `/api/employees/${editingId}` : "/api/employees", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }

      if (editingId) {
        setEmployees((current) => current.map((employee) => employee.id === editingId
          ? {
              ...employee,
              firstName: draft.firstName,
              lastName: draft.lastName,
              email: draft.email.toLowerCase(),
              phone: draft.phone || null,
              role: draft.role,
            }
          : employee));
      } else if (typeof result === "object" && result !== null && "id" in result && typeof result.id === "string") {
        const newEmployee: Employee = {
          ...draft,
          id: result.id,
          email: draft.email.toLowerCase(),
          phone: draft.phone || null,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        setEmployees((current) => [...current, newEmployee].sort((a, b) =>
          Number(b.isActive) - Number(a.isActive) || a.lastName.localeCompare(b.lastName, "bs"),
        ));
      } else {
        setError("Server nije vratio sačuvani nalog. Osvježite stranicu.");
        return;
      }
      resetForm();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function setActive(employee: Employee, isActive: boolean) {
    setError("");
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }
      setEmployees((current) => current.map((entry) => entry.id === employee.id
        ? { ...entry, isActive }
        : entry));
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    }
  }

  const active = employees.filter((employee) => employee.isActive);
  const inactive = employees.filter((employee) => !employee.isActive);

  function employeeCard(employee: Employee) {
    return (
      <article className="flex flex-col gap-3 rounded-lg border border-[#eef1ef] p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" key={employee.id}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-sm font-bold">{employee.firstName} {employee.lastName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${employee.isActive ? "bg-green-soft text-green-dark" : "bg-[#f1f3f2] text-muted"}`}>
              {employee.isActive ? "Aktivan" : "Deaktiviran"}
            </span>
            {employee.id === currentUserId ? <span className="text-[10px] font-semibold text-muted">Vi</span> : null}
          </div>
          <p className="mb-0 mt-1 break-all text-xs text-muted">{employee.email}</p>
          <p className="mb-0 mt-1 text-xs text-muted">{roleName(employee.role)}{employee.phone ? ` · ${employee.phone}` : ""}</p>
        </div>
        <div className="flex gap-2 sm:flex-none">
          <button
            className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold text-[#53645a] hover:bg-[#f7faf8]"
            type="button"
            onClick={() => startEditing(employee)}
          >
            Uredi
          </button>
          {employee.id !== currentUserId ? (
            <button
              className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold text-[#53645a] hover:bg-[#f7faf8]"
              type="button"
              onClick={() => void setActive(employee, !employee.isActive)}
            >
              {employee.isActive ? "Deaktiviraj" : "Aktiviraj"}
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
      <section className="min-w-0 rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        {error ? <p className="mb-3 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">{error}</p> : null}
        <h2 className="m-0 text-base font-bold">Aktivni nalozi ({active.length})</h2>
        <div className="mt-3 space-y-2">{active.map(employeeCard)}</div>
        {inactive.length ? (
          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#53645a]">Deaktivirani nalozi ({inactive.length})</summary>
            <div className="mt-3 space-y-2">{inactive.map(employeeCard)}</div>
          </details>
        ) : null}
      </section>

      <section className="h-fit rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        <h2 className="m-0 text-base font-bold">{editingId ? "Uredi korisnički nalog" : "Dodaj zaposlenog"}</h2>
        <form className="mt-4 grid gap-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              Ime *
              <input className={inputClass} value={draft.firstName} onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))} maxLength={100} required />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              Prezime *
              <input className={inputClass} value={draft.lastName} onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))} maxLength={100} required />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            E-mail *
            <input className={inputClass} type="email" autoComplete="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} maxLength={254} required />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Telefon
            <input className={inputClass} type="tel" autoComplete="tel" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} maxLength={40} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Uloga *
            <select className={inputClass} value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as EmployeeRole }))}>
              {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            {editingId ? "Nova lozinka (opcionalno)" : "Početna lozinka *"}
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={draft.password}
              onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
              minLength={12}
              maxLength={128}
              required={!editingId}
            />
            <span className="font-normal">Najmanje 12 znakova.</span>
          </label>
          {editingId ? (
            <button className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold text-[#53645a]" type="button" onClick={resetForm}>
              Odustani od izmjena
            </button>
          ) : null}
          <button className="min-h-11 rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Čuvanje..." : editingId ? "Sačuvaj izmjene" : "Kreiraj nalog"}
          </button>
        </form>
      </section>
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
