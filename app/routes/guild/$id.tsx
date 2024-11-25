import { createFileRoute } from "@tanstack/react-router";

const RouteComponent = () => {
  const { id } = Route.useParams();

  return `Hello /guild/${id}!`;
};

export const Route = createFileRoute("/guild/$id")({
  component: RouteComponent,
});
