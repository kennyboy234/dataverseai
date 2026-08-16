export default function PortfolioPage() {
    const skills = ["Excel", "SPSS", "EViews", "SQL", "Python", "Power BI", "Data Cleaning", "Statistical Analysis", "Regression", "Forecasting"];
    const services = [
      { title: "Data Analysis", desc: "Turning raw datasets into clear, actionable insights using Excel, SPSS, Python, and more." },
      { title: "Research Support", desc: "Helping students and researchers with statistical analysis, thesis chapters, and academic writing." },
      { title: "Video Editing", desc: "Creating polished promotional and commercial video content using CapCut and motion graphics." }
    ];
  
    return (
      <main className="max-w-5xl mx-auto px-6 py-20">
        <section className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-2">Oloyede Kehinde Daniel</h1>
          <p className="text-xl text-blue-600 font-medium mb-6">Founder & Lead Analytics Expert</p>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">Building DataVerse AI while helping researchers and businesses turn data into decisions.</p>
        </section>
  
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 text-center">
          <div className="p-6 border rounded-lg"><p className="text-3xl font-bold text-blue-600">10+</p><p className="text-gray-600 mt-1">Research Projects Supported</p></div>
          <div className="p-6 border rounded-lg"><p className="text-3xl font-bold text-blue-600">5+</p><p className="text-gray-600 mt-1">Disciplines Covered</p></div>
          <div className="p-6 border rounded-lg"><p className="text-3xl font-bold text-blue-600">1</p><p className="text-gray-600 mt-1">Platform Being Built</p></div>
        </section>
  
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Skills</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {skills.map((skill) => (
              <span key={skill} className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700">{skill}</span>
            ))}
          </div>
        </section>
  
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.map((service) => (
              <div key={service.title} className="p-6 border rounded-lg">
                <h3 className="font-bold text-lg mb-2">{service.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </section>
  
        <section className="text-center">
          <h2 className="text-2xl font-bold mb-4">Work with me</h2>
          <a href="/contact" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition">Get in Touch</a>
        </section>
      </main>
    );
  }