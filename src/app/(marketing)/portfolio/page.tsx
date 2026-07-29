// src\app\(marketing)\portfolio\page.tsx

const SKILLS = [
  "Excel", "SPSS", "EViews", "SQL", "Python", "Power BI",
  "Data Cleaning", "Statistical Analysis", "Regression", "Forecasting",
];

const SERVICES = [
  {
    title: "Data Analysis",
    description:
      "Statistical analysis, data cleaning, and interpretation for research and business needs using Excel, SPSS, and EViews.",
  },
  {
    title: "Research Support",
    description:
      "Thesis and dissertation support statistical chapters, ethics applications, and methodology guidance for university students.",
  },
  {
    title: "Video Editing",
    description:
      "Professional video editing and motion graphics using CapCut, from social content to brand animations.",
  },
];

const STATS = [
  { value: "10+", label: "Research Projects Supported" },
  { value: "5+", label: "Disciplines Covered" },
  { value: "1", label: "Platform Being Built" },
];

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-[#111827] dark:text-gray-100">
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-[#2563EB]/5 blur-3xl" />
          <div className="absolute -bottom-20 left-0 h-[400px] w-[400px] rounded-full bg-[#7C3AED]/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-[#2563EB]/25">
            OK
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#2563EB]">
            Founder and Lead Analytics Expert
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Oloyede Kehinde Daniel
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            Building DataVerse AI, an all-in-one data analytics platform, while
            helping researchers, students, and businesses turn raw data into
            clear, actionable insight.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-gray-900/50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl grid grid-cols-3 gap-6 text-center">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-[#2563EB]">{stat.value}</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-10">Skills and Tools</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {SKILLS.map((skill) => (
              <span
                key={skill}
                className="px-4 py-2 rounded-full bg-[#2563EB]/10 text-[#2563EB] text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-gray-900/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-10">Services</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {SERVICES.map((service) => (
              <div
                key={service.title}
                className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
              >
                <h3 className="font-semibold text-lg">{service.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold">Work with me</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            Whether it is a research project, a data analysis task, or a
            question about DataVerse AI, reach out.
          </p>
          <a
            href="/contact"
            className="mt-6 inline-block rounded-xl bg-[#2563EB] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#2563EB]/25 hover:bg-[#1D4ED8] transition"
          >
            Get in Touch
          </a>
        </div>
      </section>
    </div>
  );
}