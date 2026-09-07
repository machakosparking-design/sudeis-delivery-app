import React, { useState, useEffect } from 'react';
import './LandingPage.css';
import FalconIcon from './FalconIcon';
import { 
  Package, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  ShoppingBag, 
  Zap, 
  Headphones, 
  LogIn, 
  ExternalLink,
  MessageCircle,
  Menu,
  X
} from 'lucide-react';

export default function LandingPage({ onGoToApp }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsAnimated, setStatsAnimated] = useState(false);
  const [counts, setCounts] = useState({ onTime: 0, parcels: 0, verified: 0 });

  // Scroll Reveal Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            if (entry.target.classList.contains('stats-section')) {
              setStatsAnimated(true);
            }
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Smooth Count-up Animation for Metrics
  useEffect(() => {
    if (!statsAnimated) return;
    const start = performance.now();
    const duration = 1600;

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCounts({
        onTime: (ease * 99.8).toFixed(1),
        parcels: Math.floor(ease * 10000),
        verified: Math.floor(ease * 100)
      });
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    const reqId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(reqId);
  }, [statsAnimated]);

  const services = [
    {
      icon: <Zap className="service-icon text-amber" />,
      title: "Same-Day Express Courier",
      description: "Urgent point-to-point delivery within Nairobi, Machakos, and surrounding towns. We pick up and deliver in record time.",
      features: ["Immediate rider dispatch", "Live GPS tracking", "Door-to-door direct delivery"]
    },
    {
      icon: <ShoppingBag className="service-icon text-blue" />,
      title: "E-Commerce & COD Fulfillment",
      description: "Reliable logistics partner for online businesses, Instagram shops, and vendors. We handle deliveries and Cash on Delivery.",
      features: ["Cash on Delivery (COD) collection", "Fast merchant payment remittance", "Proof of delivery confirmation"]
    },
    {
      icon: <Building2 className="service-icon text-emerald" />,
      title: "Corporate & Scheduled Courier",
      description: "Dedicated courier services for law firms, offices, and corporations for documents, contracts, and daily scheduled runs.",
      features: ["Scheduled recurring pickups", "Confidential & secure handling", "Monthly corporate invoicing"]
    },
    {
      icon: <Package className="service-icon text-purple" />,
      title: "Inter-County Parcel Delivery",
      description: "Fast, dependable parcel shipping connecting Nairobi, Machakos, Kiambu, and regional hubs across Kenya.",
      features: ["Overnight & next-day options", "Safe parcel handling", "Transparent affordable rates"]
    }
  ];

  const workflowSteps = [
    {
      step: "01",
      title: "Book Your Delivery",
      desc: "Reach out via WhatsApp, phone, or our portal with your pickup and drop-off locations."
    },
    {
      step: "02",
      title: "Instant Rider Dispatch",
      desc: "The nearest verified Falcon Delivery rider is assigned immediately to pick up your package."
    },
    {
      step: "03",
      title: "Safe & Fast Delivery",
      desc: "Your recipient receives the parcel safely with instant digital confirmation and real-time updates."
    }
  ];

  const stats = [
    { number: "99.8%", label: "On-Time Delivery" },
    { number: "10,000+", label: "Parcels Delivered" },
    { number: "100%", label: "Verified Riders" },
    { number: "24/7", label: "Customer Support" }
  ];

  return (
    <div className="landing-wrapper">
      {/* Top Notification Bar */}
      <div className="top-banner">
        <span>Fast, Reliable & Secure Delivery Across Kenya — <strong>Nairobi, Mombasa & Countrywide</strong></span>
        <a href="https://wa.me/254700000000" target="_blank" rel="noopener noreferrer" className="banner-link">
          <MessageCircle size={14} /> Quick WhatsApp Booking
        </a>
      </div>

      {/* Navigation Header */}
      <header className="landing-nav">
        <div className="nav-container">
          <div className="brand-logo">
            <div className="logo-icon-wrap">
              <FalconIcon size={24} className="logo-icon" />
            </div>
            <div className="brand-text">
              <span className="brand-title">Falcon<span className="brand-accent">Delivery</span></span>
              <span className="brand-tagline">Express Courier Services</span>
            </div>
          </div>

          <nav className={`nav-links ${mobileMenuOpen ? 'mobile-active' : ''}`}>
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>About Us</a>
            <a href="#services" onClick={() => setMobileMenuOpen(false)}>Services</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#why-us" onClick={() => setMobileMenuOpen(false)}>Why Falcon</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
          </nav>

          <div className="nav-actions">
            <button className="btn-portal-login" onClick={() => onGoToApp('rider')}>
              <LogIn size={16} />
              <span>Operations Portal</span>
            </button>
            <button className="menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        {/* Live Animated Falcon Sky Backdrop */}
        <div className="hero-sky-backdrop" aria-hidden="true">
          {/* Main Soaring Falcon */}
          <div className="falcon-flight-track main-falcon">
            <div className="falcon-vapor-trail" />
            <div className="falcon-body-wrap">
              <svg viewBox="0 0 100 65" className="falcon-live-svg">
                {/* Left Wing */}
                <g className="falcon-wing-left">
                  <path d="M48 28 C35 12 18 2 2 0 C8 10 18 20 35 28 C26 31 16 32 8 32 C18 36 30 36 45 32 Z" fill="#1E3A8A" />
                  <path d="M45 28 C32 15 18 6 5 4 C10 12 20 20 35 27 Z" fill="#2563EB" opacity="0.75" />
                </g>
                {/* Torso, Head, Hooked Beak, Tail */}
                <path d="M78 28 C85 27 92 25 98 28 C96 32 90 34 84 34 L78 35 C70 42 58 45 42 42 L25 58 L32 45 C28 44 24 43 20 42 L38 34 L55 33 C64 33 72 31 78 28 Z" fill="#0F172A" />
                {/* Keen Raptor Eye */}
                <circle cx="88" cy="29" r="1.8" fill="#F59E0B" />
                <circle cx="88.5" cy="28.8" r="0.8" fill="#000000" />
                {/* Golden Curved Beak */}
                <path d="M94 28 C97 27 100 29 97 32 C95 33 93 31 94 28 Z" fill="#F59E0B" />
                {/* Right Wing */}
                <g className="falcon-wing-right">
                  <path d="M52 28 C65 14 80 4 94 2 C88 12 78 22 62 28 C70 31 78 32 85 32 C75 36 64 36 50 32 Z" fill="#1D4ED8" />
                  <path d="M54 27 C66 16 78 8 90 6 C85 14 75 22 62 27 Z" fill="#3B82F6" opacity="0.65" />
                </g>
              </svg>
            </div>
          </div>

          {/* Distant Escort Falcon 1 */}
          <div className="falcon-flight-track distant-falcon-1">
            <div className="falcon-body-wrap">
              <svg viewBox="0 0 100 65" className="falcon-live-svg">
                <path d="M48 28 C35 12 18 2 2 0 C8 10 18 20 35 28 C26 31 16 32 8 32 C18 36 30 36 45 32 Z" fill="#1E293B" />
                <path d="M78 28 C85 27 92 25 98 28 C96 32 90 34 84 34 L78 35 C70 42 58 45 42 42 L25 58 L32 45 C28 44 24 43 20 42 L38 34 L55 33 C64 33 72 31 78 28 Z" fill="#0F172A" />
                <path d="M52 28 C65 14 80 4 94 2 C88 12 78 22 62 28 C70 31 78 32 85 32 C75 36 64 36 50 32 Z" fill="#1E293B" />
              </svg>
            </div>
          </div>

          {/* Distant Escort Falcon 2 */}
          <div className="falcon-flight-track distant-falcon-2">
            <div className="falcon-body-wrap">
              <svg viewBox="0 0 100 65" className="falcon-live-svg">
                <path d="M48 28 C35 12 18 2 2 0 C8 10 18 20 35 28 C26 31 16 32 8 32 C18 36 30 36 45 32 Z" fill="#334155" />
                <path d="M78 28 C85 27 92 25 98 28 C96 32 90 34 84 34 L78 35 C70 42 58 45 42 42 L25 58 L32 45 C28 44 24 43 20 42 L38 34 L55 33 C64 33 72 31 78 28 Z" fill="#1E293B" />
                <path d="M52 28 C65 14 80 4 94 2 C88 12 78 22 62 28 C70 31 78 32 85 32 C75 36 64 36 50 32 Z" fill="#334155" />
              </svg>
            </div>
          </div>
        </div>

        {/* Live Animated Bodaboda Road Courier Animation */}
        <div className="hero-road-backdrop" aria-hidden="true">
          <div className="bodaboda-flight-track">
            {/* Speed dust trail puffing behind rear wheel */}
            <div className="boda-dust-trail" />
            
            <div className="bodaboda-body-wrap">
              <svg viewBox="0 0 190 120" className="bodaboda-live-svg">
                <defs>
                  <linearGradient id="headlightBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.85"/>
                    <stop offset="35%" stopColor="#FEF08A" stopOpacity="0.35"/>
                    <stop offset="100%" stopColor="#FEF08A" stopOpacity="0"/>
                  </linearGradient>
                  <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB"/>
                    <stop offset="100%" stopColor="#1D4ED8"/>
                  </linearGradient>
                  <linearGradient id="vestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#A3E635"/>
                    <stop offset="100%" stopColor="#65A30D"/>
                  </linearGradient>
                </defs>

                {/* Headlight beam cone shining ahead onto the road */}
                <polygon points="144,52 260,26 260,84" fill="url(#headlightBeam)" className="boda-headlight-cone" />

                {/* Rear Carrier Rack */}
                <path d="M12,62 L42,62 L52,70" stroke="#64748B" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                
                {/* Falcon Delivery Insulated Parcel Box */}
                <rect x="10" y="32" width="34" height="28" rx="4" fill="url(#boxGrad)" stroke="#1E40AF" strokeWidth="1.5"/>
                <rect x="8" y="30" width="38" height="5" rx="2.5" fill="#3B82F6" />
                {/* Box Logo / Falcon Wings */}
                <path d="M18,46 L27,41 L36,46 L30,44 L27,47 L24,44 Z" fill="#FDE047" opacity="0.95"/>
                {/* Rear Red Reflector / Brake Light */}
                <circle cx="8" cy="62" r="2.5" fill="#EF4444"/>

                {/* Exhaust Pipe with Chrome Finish */}
                <path d="M72,76 C75,88 68,93 42,93 L16,93" stroke="#94A3B8" strokeWidth="3" fill="none" strokeLinecap="round"/>
                <rect x="22" y="91" width="16" height="4" rx="2" fill="#E2E8F0"/>

                {/* Rear Wheel Assembly (Solidly mounted to frame, spinning spokes) */}
                <g transform="translate(34, 88)">
                  <circle cx="0" cy="0" r="16" fill="#0F172A" stroke="#334155" strokeWidth="3"/>
                  <circle cx="0" cy="0" r="11" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.5"/>
                  <circle cx="0" cy="0" r="4" fill="#64748B"/>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.22s" repeatCount="indefinite" />
                    <line x1="0" y1="-11" x2="0" y2="11" stroke="#CBD5E1" strokeWidth="1.2"/>
                    <line x1="-11" y1="0" x2="11" y2="0" stroke="#CBD5E1" strokeWidth="1.2"/>
                    <line x1="-8" y1="-8" x2="8" y2="8" stroke="#CBD5E1" strokeWidth="1.2"/>
                    <line x1="8" y1="-8" x2="-8" y2="8" stroke="#CBD5E1" strokeWidth="1.2"/>
                  </g>
                </g>

                {/* Front Wheel Assembly (Solidly mounted to fork, spinning spokes) */}
                <g transform="translate(138, 88)">
                  <circle cx="0" cy="0" r="16" fill="#0F172A" stroke="#334155" strokeWidth="3"/>
                  <circle cx="0" cy="0" r="11" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.5"/>
                  <circle cx="0" cy="0" r="4" fill="#64748B"/>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.22s" repeatCount="indefinite" />
                    <line x1="0" y1="-11" x2="0" y2="11" stroke="#CBD5E1" strokeWidth="1.2"/>
                    <line x1="-11" y1="0" x2="11" y2="0" stroke="#CBD5E1" strokeWidth="1.2"/>
                    <line x1="-8" y1="-8" x2="8" y2="8" stroke="#CBD5E1" strokeWidth="1.2"/>
                    <line x1="8" y1="-8" x2="-8" y2="8" stroke="#CBD5E1" strokeWidth="1.2"/>
                  </g>
                </g>

                {/* Engine Block & Transmission */}
                <rect x="62" y="73" width="22" height="16" rx="3" fill="#334155" stroke="#1E293B" strokeWidth="1.5"/>
                <line x1="65" y1="77" x2="81" y2="77" stroke="#64748B" strokeWidth="1"/>
                <line x1="65" y1="81" x2="81" y2="81" stroke="#64748B" strokeWidth="1"/>
                <line x1="65" y1="85" x2="81" y2="85" stroke="#64748B" strokeWidth="1"/>

                {/* Motorcycle Main Frame & Swingarm */}
                <path d="M34,88 L62,77 L86,75 L122,50" stroke="#0F172A" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M62,77 L82,56 L120,52" stroke="#0F172A" strokeWidth="3" fill="none" strokeLinecap="round"/>

                {/* Fuel Tank in Falcon Blue */}
                <path d="M82,55 C84,46 100,46 120,50 C121,56 105,60 82,58 Z" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1.5"/>
                <path d="M88,50 Q105,49 116,53" stroke="#FDE047" strokeWidth="1.2" fill="none"/>

                {/* Motorcycle Seat / Saddle */}
                <path d="M48,57 C50,53 76,52 82,56 C78,60 52,61 48,57 Z" fill="#0F172A"/>

                {/* Front Fork Suspension & Fender */}
                <path d="M122,48 L138,88" stroke="#94A3B8" strokeWidth="3" fill="none" strokeLinecap="round"/>
                <path d="M126,73 Q134,71 142,74" stroke="#2563EB" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                {/* Front Amber Reflector */}
                <rect x="128" y="77" width="3" height="6" rx="1" fill="#F59E0B"/>

                {/* Handlebars & Side Mirror */}
                <path d="M120,48 L124,40 L128,41" stroke="#475569" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <circle cx="122" cy="35" r="2" fill="#94A3B8"/>
                <line x1="123" y1="37" x2="124" y2="40" stroke="#475569" strokeWidth="1.5"/>

                {/* Front Headlight Assembly */}
                <path d="M134,48 C140,48 144,50 144,52 C144,54 140,56 134,56 Z" fill="#CBD5E1" stroke="#475569" strokeWidth="1"/>
                <ellipse cx="143" cy="52" rx="2" ry="3.5" fill="#FEF08A"/>

                {/* RIDER (Boda Boda Courier) */}
                {/* Leg & Courier Riding Boot */}
                <path d="M70,56 L88,68 L82,88" stroke="#1E293B" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Boot resting on footpeg */}
                <path d="M78,88 L88,88 L90,91 L78,91 Z" fill="#0F172A"/>

                {/* Torso in High-Visibility Courier Reflector Vest */}
                <path d="M68,56 C70,44 78,36 92,34 C97,38 94,50 88,58 Z" fill="url(#vestGrad)" stroke="#4D7C0F" strokeWidth="1.2"/>
                {/* High-Vis Silver Reflective Stripe Bands */}
                <path d="M71,47 C79,43 86,39 91,38" stroke="#F8FAFC" strokeWidth="2.5" fill="none"/>
                <path d="M69,53 C77,49 84,45 89,44" stroke="#F8FAFC" strokeWidth="2.5" fill="none"/>

                {/* Arm reaching forward to handlebar with riding glove */}
                <path d="M90,36 Q106,39 124,42" stroke="#A3E635" strokeWidth="5" fill="none" strokeLinecap="round"/>
                {/* Black Riding Glove */}
                <circle cx="124" cy="42" r="3" fill="#0F172A"/>

                {/* Helmet & Tinted Aerodynamic Visor */}
                {/* Helmet Outer Shell */}
                <path d="M88,22 C88,13 97,10 105,12 C112,14 114,21 112,27 C109,31 99,32 92,29 C89,27 88,25 88,22 Z" fill="#0F172A"/>
                {/* Speed Stripe on Helmet */}
                <path d="M93,12 Q102,13 110,19" stroke="#F59E0B" strokeWidth="2" fill="none"/>
                {/* Front Visor with Cyan Gloss Reflection */}
                <path d="M104,18 C109,19 112,21 112,25 C110,26 104,26 102,24 Z" fill="#0284C7"/>
                <path d="M106,19 C108,20 110,22 110,24" stroke="#BAE6FD" strokeWidth="1" fill="none"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <ShieldCheck size={14} /> Kenya's Trusted Delivery Network
            </div>
            <h1 className="hero-title">
              Delivering Speed, Trust & Precision <span className="gradient-text">To Your Doorstep</span>
            </h1>
            <p className="hero-subtitle">
              From urgent business contracts to everyday e-commerce parcels, Falcon Delivery provides fast, reliable, and secure courier solutions across Kenya.
            </p>

            <div className="hero-cta-group">
              <a 
                href="https://wa.me/254700000000?text=Hello%20Falcon%20Delivery,%20I%20would%20like%20to%20request%20a%20delivery." 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-hero-primary"
              >
                <MessageCircle size={18} /> Book a Delivery on WhatsApp
              </a>
              <button className="btn-hero-secondary" onClick={() => onGoToApp('rider')}>
                <span>Staff & Rider Login</span>
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="hero-trust-list">
              <div className="trust-item"><CheckCircle2 size={16} className="text-emerald" /> Same-Day Delivery</div>
              <div className="trust-item"><CheckCircle2 size={16} className="text-emerald" /> Real-time Tracking</div>
              <div className="trust-item"><CheckCircle2 size={16} className="text-emerald" /> Safe COD Handling</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section reveal-on-scroll">
        <div className="stats-container">
          <div className="stat-card stagger-1">
            <h3 className="stat-number">{statsAnimated ? `${counts.onTime}%` : '99.8%'}</h3>
            <p className="stat-label">On-Time Delivery</p>
          </div>
          <div className="stat-card stagger-2">
            <h3 className="stat-number">{statsAnimated ? `${counts.parcels.toLocaleString()}+` : '10,000+'}</h3>
            <p className="stat-label">Parcels Delivered</p>
          </div>
          <div className="stat-card stagger-3">
            <h3 className="stat-number">{statsAnimated ? `${counts.verified}%` : '100%'}</h3>
            <p className="stat-label">Verified Riders</p>
          </div>
          <div className="stat-card stagger-4">
            <h3 className="stat-number">24/7</h3>
            <p className="stat-label">Customer Support</p>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="about-section reveal-on-scroll">
        <div className="section-container">
          <div className="section-header stagger-1">
            <span className="section-tag">About Falcon Delivery</span>
            <h2 className="section-title">Your Dedicated Logistics Partner in Kenya</h2>
            <p className="section-desc">
              Falcon Delivery was founded to bridge the gap between businesses and their customers with fast, reliable, and technologically advanced courier services. Whether you are an e-commerce brand, a corporate entity, or an individual sending an urgent package, we ensure swift, hassle-free transportation every single time.
            </p>
          </div>
        </div>
      </section>

      {/* What We Do (Services) */}
      <section id="services" className="services-section reveal-on-scroll">
        <div className="section-container">
          <div className="section-header text-center stagger-1">
            <span className="section-tag">What We Do</span>
            <h2 className="section-title">Comprehensive Courier & Logistics Services</h2>
            <p className="section-desc">
              Tailored delivery solutions designed to meet the dynamic needs of modern businesses and individuals.
            </p>
          </div>

          <div className="services-grid">
            {services.map((service, index) => (
              <div key={index} className={`service-card stagger-${index + 1}`}>
                <div className="service-icon-box">{service.icon}</div>
                <h3 className="service-title">{service.title}</h3>
                <p className="service-text">{service.description}</p>
                <ul className="service-feature-list">
                  {service.features.map((feat, fIndex) => (
                    <li key={fIndex}>
                      <CheckCircle2 size={14} className="feature-check" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-it-works-section reveal-on-scroll">
        <div className="section-container">
          <div className="section-header text-center stagger-1">
            <span className="section-tag">Seamless Process</span>
            <h2 className="section-title">How Falcon Delivery Works</h2>
            <p className="section-desc">Sending a package is simple, fast, and completely stress-free.</p>
          </div>

          <div className="workflow-grid">
            {workflowSteps.map((step, idx) => (
              <div key={idx} className={`workflow-card stagger-${idx + 1}`}>
                <div className="step-badge">{step.step}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="why-us" className="why-us-section reveal-on-scroll">
        <div className="section-container">
          <div className="why-us-grid">
            <div className="why-us-text stagger-1">
              <span className="section-tag">Why Choose Us</span>
              <h2 className="section-title">Built for Speed, Reliability, and Peace of Mind</h2>
              <p className="section-desc">
                We combine experienced local riders with real-time operational management to deliver an unmatched courier experience.
              </p>

              <div className="features-checklist">
                <div className="feature-box">
                  <ShieldCheck className="feat-icon text-emerald" />
                  <div>
                    <h4>100% Verified & Trained Riders</h4>
                    <p>Every rider in our fleet is vetted, trained, and equipped for professional parcel handling.</p>
                  </div>
                </div>

                <div className="feature-box">
                  <Clock className="feat-icon text-blue" />
                  <div>
                    <h4>Strict Punctuality Guarantee</h4>
                    <p>We prioritize prompt pickups and timely delivery deadlines without unnecessary delays.</p>
                  </div>
                </div>

                <div className="feature-box">
                  <Headphones className="feat-icon text-amber" />
                  <div>
                    <h4>Dedicated Customer Support</h4>
                    <p>Live assistance whenever you need an update or have special delivery instructions.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="why-us-card stagger-2">
              <div className="portal-promo-card">
                <FalconIcon size={40} className="text-amber mb-3" />
                <h3>Falcon Operations System</h3>
                <p>Are you a Falcon Delivery team member, rider, or partner? Access the central dispatch management system.</p>
                <button className="btn-portal-cta" onClick={() => onGoToApp('rider')}>
                  <span>Open System Portal</span>
                  <ExternalLink size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage & Contact Section */}
      <section id="contact" className="contact-section reveal-on-scroll">
        <div className="section-container">
          <div className="contact-card">
            <div className="contact-info-col stagger-1">
              <span className="section-tag-light">Get in Touch</span>
              <h2>Ready to Send a Parcel or Partner with Us?</h2>
              <p>Contact our dispatch team directly for instant pickups, quotes, or corporate courier partnerships.</p>
              
              <div className="contact-details">
                <div className="contact-item">
                  <MapPin className="contact-icon" />
                  <div>
                    <strong>Head Office & Hubs:</strong>
                    <span>Nairobi & Machakos, Kenya</span>
                  </div>
                </div>

                <div className="contact-item">
                  <Phone className="contact-icon" />
                  <div>
                    <strong>Direct Call / Booking:</strong>
                    <span>+254 700 000 000 / +254 711 000 000</span>
                  </div>
                </div>

                <div className="contact-item">
                  <MessageCircle className="contact-icon" />
                  <div>
                    <strong>WhatsApp Direct:</strong>
                    <span>Available 24/7 for fast dispatch requests</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="contact-cta-col stagger-2">
              <div className="action-box">
                <h3>Instant WhatsApp Dispatch</h3>
                <p>Chat with our support team to schedule an immediate pickup or inquire about corporate delivery rates.</p>
                <a 
                  href="https://wa.me/254700000000?text=Hello%20Falcon%20Delivery,%20I%20would%20like%20to%20inquire%20about%20a%20delivery." 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-whatsapp-large"
                >
                  <MessageCircle size={20} /> Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="brand-logo">
              <div className="logo-icon-wrap">
                <FalconIcon size={20} className="logo-icon" />
              </div>
              <span className="brand-title">Falcon<span className="brand-accent">Delivery</span></span>
            </div>
            <p className="footer-desc">
              Reliable, secure, and lightning-fast parcel delivery and logistics solutions across Kenya.
            </p>
          </div>

          <div className="footer-links-col">
            <h4>Quick Links</h4>
            <a href="#about">About Us</a>
            <a href="#services">Services</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#contact">Contact Support</a>
          </div>

          <div className="footer-links-col">
            <h4>Operations</h4>
            <button className="footer-link-btn" onClick={() => onGoToApp('ceo')}>CEO Admin Panel</button>
            <button className="footer-link-btn" onClick={() => onGoToApp('rider')}>Rider Dispatch Portal</button>
            <a href="https://wa.me/254719664975" target="_blank" rel="noopener noreferrer">WhatsApp Support</a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Falcon Delivery Kenya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
