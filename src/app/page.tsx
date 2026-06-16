import { getTranslations } from "next-intl/server";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  MessageSquare,
  FlaskConical,
  Brain,
  Shield,
  Zap,
} from "lucide-react";

export default async function HomePage() {
  const t = await getTranslations("landing");

  const features = [
    {
      icon: BookOpen,
      title: t("featureOrganizeTitle"),
      description: t("featureOrganizeDescription"),
    },
    {
      icon: MessageSquare,
      title: t("featureChatTitle"),
      description: t("featureChatDescription"),
    },
    {
      icon: FlaskConical,
      title: t("featureTestsTitle"),
      description: t("featureTestsDescription"),
    },
    {
      icon: Brain,
      title: t("featureRagTitle"),
      description: t("featureRagDescription"),
    },
    {
      icon: Shield,
      title: t("featurePrivacyTitle"),
      description: t("featurePrivacyDescription"),
    },
    {
      icon: Zap,
      title: t("featureFastTitle"),
      description: t("featureFastDescription"),
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium text-muted-foreground mb-8">
            <span className="flex h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            {t("badge")}
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6">
            {t("title")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("description")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <LinkButton href="/setup" size="lg" className="gap-2">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              {t("primaryCta")}
            </LinkButton>
            <LinkButton href="/setup" size="lg" variant="outline" className="gap-2">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
              {t("secondaryCta")}
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              {t("featuresTitle")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t("featuresSubtitle")}
            </p>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title}>
                <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5">
                  <CardContent className="pt-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle as="h3" className="text-lg font-semibold mb-2">
                      {feature.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl bg-primary text-primary-foreground p-8 sm:p-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              {t("ctaTitle")}
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              {t("ctaDescription")}
            </p>
            <LinkButton href="/dashboard" size="lg" variant="secondary" className="gap-2">
              <Zap className="h-5 w-5" aria-hidden="true" />
              {t("ctaButton")}
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}
