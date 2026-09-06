import React, { useState } from 'react';
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
        <span>🚀 Fast, Reliable & Secure Delivery Across Kenya — <strong>Machakos, Nairobi & Countrywide</strong></span>
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
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="pulse-dot"></span> Kenya's Trusted Delivery Network
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

          <div className="hero-visual">
            <div className="visual-card">
              <div className="card-header-badge">
                <span className="live-indicator"></span> Live Delivery Active
              </div>
              <div className="visual-illustration">
                <div className="delivery-falcon-circle">
                  <FalconIcon size={48} className="text-blue" />
                </div>
                <div className="route-line">
                  <div className="route-dot start"></div>
                  <div className="route-dot end"></div>
                </div>
              </div>
              <div className="visual-info">
                <div className="info-row">
                  <span className="info-label">Route</span>
                  <span className="info-val">Nairobi ➔ Machakos & Metro</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Dispatch Status</span>
                  <span className="info-val status-badge">⚡ Instant Dispatch</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Care Level</span>
                  <span className="info-val">100% Protected & Insured</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card">
              <h3 className="stat-number">{stat.number}</h3>
              <p className="stat-label">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="about-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">About Falcon Delivery</span>
            <h2 className="section-title">Your Dedicated Logistics Partner in Kenya</h2>
            <p className="section-desc">
              Falcon Delivery was founded to bridge the gap between businesses and their customers with fast, reliable, and technologically advanced courier services. Whether you are an e-commerce brand, a corporate entity, or an individual sending an urgent package, we ensure swift, hassle-free transportation every single time.
            </p>
          </div>
        </div>
      </section>

      {/* What We Do (Services) */}
      <section id="services" className="services-section">
        <div className="section-container">
          <div className="section-header text-center">
            <span className="section-tag">What We Do</span>
            <h2 className="section-title">Comprehensive Courier & Logistics Services</h2>
            <p className="section-desc">
              Tailored delivery solutions designed to meet the dynamic needs of modern businesses and individuals.
            </p>
          </div>

          <div className="services-grid">
            {services.map((service, index) => (
              <div key={index} className="service-card">
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
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-container">
          <div className="section-header text-center">
            <span className="section-tag">Seamless Process</span>
            <h2 className="section-title">How Falcon Delivery Works</h2>
            <p className="section-desc">Sending a package is simple, fast, and completely stress-free.</p>
          </div>

          <div className="workflow-grid">
            {workflowSteps.map((step, idx) => (
              <div key={idx} className="workflow-card">
                <div className="step-badge">{step.step}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="why-us" className="why-us-section">
        <div className="section-container">
          <div className="why-us-grid">
            <div className="why-us-text">
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

            <div className="why-us-card">
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
      <section id="contact" className="contact-section">
        <div className="section-container">
          <div className="contact-card">
            <div className="contact-info-col">
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

            <div className="contact-cta-col">
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
