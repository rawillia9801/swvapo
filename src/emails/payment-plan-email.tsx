import * as React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

export type PaymentPlanEmailKind =
  | "receipt"
  | "due_reminder"
  | "late_notice"
  | "default_notice";

type PaymentPlanEmailProps = {
  kind: PaymentPlanEmailKind;
  buyerName: string;
  puppyLabel: string;
  subjectLine: string;
  previewText: string;
  messageLead: string;
  supportingCopy: string;
  amountLabel?: string;
  dueDateLabel?: string;
  balanceLabel?: string;
  monthlyAmountLabel?: string;
  paymentMethodLabel?: string;
  referenceLabel?: string;
  actionLabel?: string;
  actionHref?: string;
  footerNote?: string;
};

const paletteByKind: Record<PaymentPlanEmailKind, { badge: string; accent: string; soft: string }> = {
  receipt: {
    badge: "#5b8b68",
    accent: "#2f6b44",
    soft: "#edf6ef",
  },
  due_reminder: {
    badge: "#a56b29",
    accent: "#8c5b23",
    soft: "#fbf2e4",
  },
  late_notice: {
    badge: "#a0522d",
    accent: "#8a4322",
    soft: "#f8ece5",
  },
  default_notice: {
    badge: "#8e3f36",
    accent: "#7b332c",
    soft: "#f8e9e7",
  },
};

const bodyStyle = {
  backgroundColor: "#f6f0e8",
  color: "#3d2a1f",
  fontFamily:
    "'Aptos', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "28px 0",
};

const containerStyle = {
  backgroundColor: "#fffaf5",
  border: "1px solid #e7d9c9",
  borderRadius: "28px",
  boxShadow: "0 18px 48px rgba(106, 76, 45, 0.10)",
  margin: "0 auto",
  maxWidth: "620px",
  overflow: "hidden",
};

const headerStyle = {
  background:
    "linear-gradient(135deg, rgba(233,214,192,0.96) 0%, rgba(255,250,245,0.98) 58%, rgba(244,232,220,0.9) 100%)",
  borderBottom: "1px solid #ead8c4",
  padding: "32px 34px 24px",
};

const contentStyle = {
  padding: "28px 34px 34px",
};

const eyebrowStyle = {
  borderRadius: "999px",
  display: "inline-block",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.18em",
  padding: "8px 14px",
  textTransform: "uppercase" as const,
};

const headingStyle = {
  color: "#342116",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "30px",
  fontWeight: "700",
  letterSpacing: "-0.03em",
  lineHeight: "1.12",
  margin: "18px 0 10px",
};

const leadStyle = {
  color: "#5c4637",
  fontSize: "15px",
  lineHeight: "1.75",
  margin: "0",
};

const cardStyle = {
  backgroundColor: "#fffdfb",
  border: "1px solid #eadccf",
  borderRadius: "22px",
  padding: "18px 18px 16px",
};

const cardLabelStyle = {
  color: "#8b6e56",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.14em",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
};

const cardValueStyle = {
  color: "#342116",
  fontSize: "18px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin: "0",
};

const cardDetailStyle = {
  color: "#6c5647",
  fontSize: "13px",
  lineHeight: "1.65",
  margin: "8px 0 0",
};

const sectionTitleStyle = {
  color: "#8b6e56",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.16em",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
};

const bodyTextStyle = {
  color: "#5c4637",
  fontSize: "14px",
  lineHeight: "1.78",
  margin: "0",
};

const buttonStyle = {
  backgroundColor: "#b5752f",
  borderRadius: "999px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "700",
  padding: "14px 22px",
  textDecoration: "none",
};

function DetailCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Column style={{ paddingBottom: "12px", verticalAlign: "top", width: "50%" }}>
      <Section style={cardStyle}>
        <Text style={cardLabelStyle}>{label}</Text>
        <Text style={cardValueStyle}>{value}</Text>
        {detail ? <Text style={cardDetailStyle}>{detail}</Text> : null}
      </Section>
    </Column>
  );
}

export default function PaymentPlanEmail({
  kind,
  buyerName,
  puppyLabel,
  subjectLine,
  previewText,
  messageLead,
  supportingCopy,
  amountLabel,
  dueDateLabel,
  balanceLabel,
  monthlyAmountLabel,
  paymentMethodLabel,
  referenceLabel,
  actionLabel,
  actionHref,
  footerNote,
}: PaymentPlanEmailProps) {
  const palette = paletteByKind[kind];
  const cards = [
    amountLabel ? { label: kind === "receipt" ? "Payment Received" : "Scheduled Amount", value: amountLabel } : null,
    dueDateLabel ? { label: kind === "receipt" ? "Applied Date" : "Due Date", value: dueDateLabel } : null,
    balanceLabel ? { label: "Balance Snapshot", value: balanceLabel } : null,
    monthlyAmountLabel ? { label: "Monthly Plan", value: monthlyAmountLabel } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text
              style={{
                ...eyebrowStyle,
                backgroundColor: palette.soft,
                color: palette.badge,
              }}
            >
              Southwest Virginia Chihuahua
            </Text>
            <Heading style={headingStyle}>{subjectLine}</Heading>
            <Text style={leadStyle}>
              {buyerName}, {messageLead}
            </Text>
          </Section>

          <Section style={contentStyle}>
            <Text style={sectionTitleStyle}>Plan Snapshot</Text>
            <Text style={{ ...bodyTextStyle, marginBottom: "18px" }}>
              Payment plan for {puppyLabel}.
            </Text>

            {cards.length ? (
              <Row>
                {cards.slice(0, 2).map((card) => (
                  <DetailCard key={card.label} label={card.label} value={card.value} />
                ))}
              </Row>
            ) : null}

            {cards.length > 2 ? (
              <Row>
                {cards.slice(2, 4).map((card) => (
                  <DetailCard key={card.label} label={card.label} value={card.value} />
                ))}
              </Row>
            ) : null}

            <Section
              style={{
                ...cardStyle,
                backgroundColor: "#fffcf8",
                marginTop: "8px",
              }}
            >
              <Text style={sectionTitleStyle}>Update</Text>
              <Text style={bodyTextStyle}>{supportingCopy}</Text>
              {paymentMethodLabel ? (
                <Text style={{ ...bodyTextStyle, marginTop: "12px" }}>
                  Payment method: <strong>{paymentMethodLabel}</strong>
                </Text>
              ) : null}
              {referenceLabel ? (
                <Text style={{ ...bodyTextStyle, marginTop: "8px" }}>
                  Reference: <strong>{referenceLabel}</strong>
                </Text>
              ) : null}
            </Section>

            {actionLabel && actionHref ? (
              <Section style={{ marginTop: "22px", textAlign: "center" as const }}>
                <Button href={actionHref} style={buttonStyle}>
                  {actionLabel}
                </Button>
              </Section>
            ) : null}

            <Section style={{ marginTop: "24px" }}>
              <Text
                style={{
                  color: palette.accent,
                  fontSize: "13px",
                  lineHeight: "1.7",
                  margin: "0",
                }}
              >
                {footerNote ||
                  "If you need help updating your payment method or reviewing your account, just reply to this email and we will take care of you."}
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
