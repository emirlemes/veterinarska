"use client";

export function QueryStatus({
  pending, fetching, paused, error, hasData, forbidden, onRetry,
}: {
  pending: boolean;
  fetching: boolean;
  paused: boolean;
  error: Error | null;
  hasData: boolean;
  forbidden: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {paused ? (
        <p role="status" className="py-4 text-sm text-muted">
          Nema internet veze. {hasData ? "Prikazani podaci možda nisu ažurni." : "Povežite se da biste učitali podatke."}
        </p>
      ) : pending ? (
        <p role="status" className="py-4 text-sm text-muted">Učitavanje podataka...</p>
      ) : null}
      {fetching && hasData ? <p role="status" className="py-2 text-xs text-muted">Osvježavanje podataka...</p> : null}
      {error ? (
        <div className="my-3 rounded-lg bg-[#fbefee] p-3 text-sm text-[#a43e3c]" role="alert">
          {error.message}
          {hasData ? " Prikazani podaci možda nisu ažurni." : ""}
          {!forbidden ? <button className="ml-2 underline" type="button" onClick={onRetry}>Pokušaj ponovo</button> : null}
        </div>
      ) : null}
    </>
  );
}
