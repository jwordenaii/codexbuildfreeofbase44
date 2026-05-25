import React, { useState, useEffect } from 'react';
import { fetchLocalProjects } from '../api/jworden-authority';

export default function CityLandingPage({ cityName, zipCodes }) {
  const [recentProjects, setRecentProjects] = useState([]);

  useEffect(() => {
    async function loadProof() {
      const projects = await fetchLocalProjects(cityName);
      setRecentProjects(projects);
    }
    loadProof();
  }, [cityName]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="border-b-4 border-yellow-500 pb-6 mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          Elite Asphalt Paving in {cityName}, VA
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Virginia Class A Contractors. Uncompromising quality driven by our Mauldin 690s and LeeBoy fleet.
          Zero disruption to your business with our exclusive Sunday Paving tier.
        </p>
      </header>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Verified Commercial Proof</h2>
          <p className="text-gray-600 mb-4">
            From 5-star medical facility repaving to executing 100+ high-traffic restaurant rollouts,
            we engineer surfaces built for heavy load and long-term durability.
          </p>
          <ul className="space-y-3">
            {recentProjects.map((project) => (
              <li key={project.id} className="flex items-center text-sm text-gray-700 bg-gray-50 p-3 rounded-md shadow-sm">
                <span className="font-bold text-yellow-600 mr-2">✓</span>
                {project.description} - {project.completionDate}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-900 text-white p-8 rounded-lg shadow-xl">
          <h3 className="text-xl font-bold mb-3">Weekend Diligence™ Protocol</h3>
          <p className="text-gray-300">
            Commercial logistics demand zero downtime. Our crews mobilize late Friday and execute seamlessly
            through the weekend, ensuring your property is fully operational by Monday morning.
          </p>
        </div>
      </section>
    </main>
  );
}
