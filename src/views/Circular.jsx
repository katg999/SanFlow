import Link from 'next/link';
import { Sprout, Flame, Zap, Leaf, Coins, MessageCircle, ArrowRight, Factory } from 'lucide-react';
import './Impact.css';
import './Circular.css';

const PRODUCTS = [
  { icon: Sprout, product: 'Organic fertilizer', use: 'Agriculture', benefit: 'Improves soil health, reduces chemical dependency' },
  { icon: Leaf, product: 'Biochar', use: 'Soil enhancement, carbon sequestration', benefit: 'Long-term carbon storage' },
  { icon: Flame, product: 'Briquettes', use: 'Clean cooking fuel', benefit: 'Reduces deforestation' },
  { icon: Zap, product: 'Biogas', use: 'Energy generation', benefit: 'Alternative to charcoal and firewood' },
  { icon: Coins, product: 'Carbon credits', use: 'Climate financing', benefit: 'Revenue for sustainable operations' },
];

const APPROACH = [
  'Install affordable toilet units in underserved urban and rural areas',
  'Monitor facilities in real time using low-cost IoT sensors',
  'Connect users to nearby facilities through our app and WhatsApp assistant',
  'Coordinate waste collection with service providers and exhausters',
  'Route waste to treatment, where it becomes a resource, not a problem',
];

export default function Circular() {
  return (
    <div className="impact">
      <section className="impact-hero">
        <div className="container">
          <span className="eyebrow">Toilets &amp; circular economy</span>
          <h1>Toilets as entry points, not end points</h1>
          <p>
            A toilet is not just a facility — it is the starting point of a value chain. SanFlow &amp; WASHLink
            connects every full pit to a service provider, and every load of waste to a partner who turns it into value.
          </p>
        </div>
      </section>

      <section className="impact-stats">
        <div className="container"><span className="eyebrow eyebrow-inverse">The toilet challenge in East Africa</span></div>
        <div className="container circ-facts">
          <div className="impact-stat"><span className="impact-stat-value">38M</span><span className="impact-stat-label">people in Kenya lack safely managed sanitation</span></div>
          <div className="impact-stat"><span className="impact-stat-value">90%+</span><span className="impact-stat-label">of Uganda relies on on-site sanitation that is often poorly managed</span></div>
          <div className="impact-stat"><span className="impact-stat-value">377 Mt</span><span className="impact-stat-label">CO₂e a year from non-sewered sanitation — nearly 5% of global anthropogenic methane</span></div>
        </div>
        <div className="container circ-note">
          In Tanzania, rapid urbanisation is outpacing sanitation infrastructure. The result: open defecation, overflowing latrines, contaminated water and preventable disease outbreaks.
        </div>
      </section>

      <section className="impact-outcomes">
        <div className="container">
          <div className="impact-section-heading">
            <span className="eyebrow">Our approach</span>
            <h2>From waste to value</h2>
            <p>Where treatment infrastructure exists, SanFlow connects collected waste to partners who transform it into:</p>
          </div>
          <div className="impact-grid circ-grid">
            {PRODUCTS.map(({ icon: Icon, product, use, benefit }) => (
              <div className="impact-card" key={product}>
                <div className="icon-badge"><Icon size={20} /></div>
                <h3>{product}</h3>
                <p><b>Use:</b> {use}</p>
                <p>{benefit}</p>
              </div>
            ))}
          </div>

          <div className="circ-two">
            <div className="impact-card">
              <div className="icon-badge"><Factory size={20} /></div>
              <h3>How the platform makes it happen</h3>
              <ul className="circ-list">{APPROACH.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
            <div className="impact-card">
              <div className="icon-badge"><Leaf size={20} /></div>
              <h3>Three challenges, solved together</h3>
              <ul className="circ-list">
                <li><b>Public health</b> — reduced contamination, fewer disease outbreaks</li>
                <li><b>Environment</b> — lower methane emissions, cleaner water sources</li>
                <li><b>Economy</b> — new jobs, new revenue streams, new products</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                Municipal and provider dashboards track waste delivered to treatment partners and the estimated CO₂ avoided.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="impact-cta">
        <div className="container impact-cta-inner">
          <div>
            <span className="eyebrow eyebrow-inverse">Partner with us</span>
            <h2>Building a circular sanitation economy</h2>
            <p>
              We work with municipalities seeking data-driven planning, service providers optimising operations,
              waste-to-value enterprises needing consistent feedstock, development partners supporting WASH and
              climate goals, and communities ready to improve their sanitation.
            </p>
            <p className="circ-contact">info@sanflow.co.ke · www.sanflow.co.ke</p>
          </div>
          <div className="impact-cta-actions">
            <a href="https://wa.me/256772207616" target="_blank" rel="noreferrer" className="btn btn-accent">
              <MessageCircle size={16} /> WhatsApp us
            </a>
            <Link href="/login" className="btn btn-outline">See the portals <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
