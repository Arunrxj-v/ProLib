import { Suspense } from "react";

import { CategoriesGrid, TechChipBar } from "@/components/home/Discovery";
import { Hero, HeroSkeleton } from "@/components/home/Hero";
import { Section } from "@/components/home/Section";
import {
  BuildersSection,
  ContributeCta,
  FeaturedSection,
  TrendingSection,
} from "@/components/home/Sections";
import { SpotlightSection } from "@/components/home/Spotlight";
import { ProjectGridSkeleton, Skeleton } from "@/components/ui/Panel";
import { getCategories, getTechnologies } from "@/lib/data/taxonomy";

function ChipBarSkeleton() {
  return (
    <Section className="py-8">
      <div className="mb-4 flex items-center justify-between border-b border-gh-border pb-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-24" />
        ))}
      </div>
    </Section>
  );
}

function CategoryGridSkeleton() {
  return (
    <Section>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-7 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-lg" />
        ))}
      </div>
    </Section>
  );
}

async function TechStackSection() {
  const technologies = await getTechnologies();
  return <TechChipBar technologies={technologies} />;
}

async function CategoriesSection() {
  const categories = await getCategories();
  return <CategoriesGrid categories={categories} />;
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { feed } = await searchParams;

  return (
    <div className="w-full">
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>

      <Suspense
        fallback={
          <Section>
            <div className="space-y-4">
              <Skeleton className="h-7 w-72" />
              <Skeleton className="h-80 w-full rounded-lg" />
            </div>
          </Section>
        }
      >
        <SpotlightSection />
      </Suspense>

      <Suspense fallback={<ChipBarSkeleton />}>
        <TechStackSection />
      </Suspense>

      <Suspense
        fallback={
          <Section>
            <ProjectGridSkeleton />
          </Section>
        }
      >
        <FeaturedSection />
      </Suspense>

      <Suspense
        fallback={
          <Section>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-64 rounded-lg" />
              ))}
            </div>
          </Section>
        }
      >
        <TrendingSection feed={typeof feed === "string" ? feed : "trending"} />
      </Suspense>

      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategoriesSection />
      </Suspense>

      <Suspense
        fallback={
          <Section>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-64 rounded-lg" />
              ))}
            </div>
          </Section>
        }
      >
        <BuildersSection />
      </Suspense>

      <ContributeCta />
    </div>
  );
}
