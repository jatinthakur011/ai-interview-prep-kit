export default function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="panel-danger">
      {message}
    </p>
  );
}
