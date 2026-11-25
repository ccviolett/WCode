import {
  DEFAULT_FEEDBACK_TICKET_FRAMEWORK,
  type WCodeProvider,
  type FeedbackTicketFramework,
} from "@wcode/shared";

export function inferFeedbackFrameworkFromAgentProvider(
  _provider: WCodeProvider | null | undefined,
): FeedbackTicketFramework {
  return DEFAULT_FEEDBACK_TICKET_FRAMEWORK;
}
