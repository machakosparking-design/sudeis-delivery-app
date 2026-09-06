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
            <a href="https://wa.me/254700000000" target="_blank" rel="noopener noreferrer">WhatsApp Support</a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Falcon Delivery Kenya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
