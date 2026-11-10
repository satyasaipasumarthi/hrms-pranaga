import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Ticket } from "lucide-react";

const TicketManagement = () => {
  const navigate = useNavigate();
  const [tickets] = useState<
    {
      id: string;
      title: string;
      status: string;
      priority: string;
    }[]
  >([]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Ticket Management
          </h1>
          <p className="text-muted-foreground">
            Create, assign, and track employee support tickets.
          </p>
        </div>

        <Button onClick={() => navigate("/tickets/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Ticket
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            All Tickets
          </CardTitle>
        </CardHeader>

        <CardContent>
          {tickets.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Ticket className="mx-auto mb-3 h-10 w-10" />
              <p>No tickets available yet.</p>
              <p className="mt-1 text-sm">
                Create a ticket to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className="flex w-full items-center justify-between rounded-lg border p-4 text-left hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">{ticket.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Ticket ID: {ticket.id}
                    </p>
                  </div>

                  <div className="text-right">
                    <p>{ticket.status}</p>
                    <p className="text-sm text-muted-foreground">
                      {ticket.priority} priority
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketManagement;