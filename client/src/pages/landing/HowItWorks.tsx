import { useRef, useState, useEffect } from 'react';
import { AnimatedSection } from './AnimatedSection';
import { STEPS } from './data';

function useIntersectionVisible(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function StepIcon({ index, visible }: { index: number; visible: boolean }) {
  const { icon: Icon } = STEPS[index];

  const animationClass = visible
    ? index === 0
      ? 'hiw-icon-drop'
      : index === 1
        ? 'hiw-icon-pulse'
        : 'hiw-icon-draw'
    : 'opacity-0';

  return (
    <div className="relative">
      <div
        className={`w-14 h-14 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm transition-transform ${animationClass}`}
        style={{ animationDelay: `${index * 200 + 300}ms` }}
      >
        <Icon className="h-6 w-6 text-foreground" />
      </div>
      <span className="absolute -top-2 -right-2 text-[10px] font-bold text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center">
        {STEPS[index].num}
      </span>
    </div>
  );
}

function Connector({ visible, index }: { visible: boolean; index: number }) {
  return (
    <div
      className="hidden md:flex items-center justify-center absolute top-7 -right-5 w-10 z-0"
      aria-hidden="true"
    >
      <svg width="40" height="2" className="overflow-visible">
        <line
          x1="0"
          y1="1"
          x2="40"
          y2="1"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
          className={`text-border transition-all duration-700 ${visible ? 'hiw-connector-draw' : 'opacity-0'}`}
          style={{ animationDelay: `${index * 200 + 500}ms` }}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function HowItWorks() {
  const { ref, visible } = useIntersectionVisible(0.2);

  return (
    <section className="bg-muted/20 border-y border-border/40" id="how-it-works">
      <div className="max-w-4xl mx-auto px-6 py-20" data-testid="section-how-it-works" ref={ref}>
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            From document upload to financial clarity in three simple steps.
          </p>
        </AnimatedSection>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {STEPS.map(({ title, desc }, i) => (
            <AnimatedSection key={title} delay={i * 0.15}>
              <div
                className="relative flex flex-col items-center text-center gap-4"
                data-testid={`step-${i + 1}`}
              >
                <StepIcon index={i} visible={visible} />
                <h3
                  className={`text-base font-semibold text-foreground transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                  style={{ transitionDelay: `${i * 200 + 400}ms` }}
                >
                  {title}
                </h3>
                <p
                  className={`text-sm text-muted-foreground leading-relaxed transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                  style={{ transitionDelay: `${i * 200 + 500}ms` }}
                >
                  {desc}
                </p>
                {i < STEPS.length - 1 && <Connector visible={visible} index={i} />}
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes hiw-drop-in {
          0% { opacity: 0; transform: translateY(-20px) scale(0.8); }
          60% { opacity: 1; transform: translateY(4px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hiw-pulse-in {
          0% { opacity: 0; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.1); }
          70% { opacity: 1; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes hiw-draw-in {
          0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          60% { opacity: 1; transform: scale(1.05) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes hiw-connector-appear {
          0% { stroke-dashoffset: 40; opacity: 0; }
          30% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }

        .hiw-icon-drop {
          animation: hiw-drop-in 0.6s ease-out both;
        }
        .hiw-icon-pulse {
          animation: hiw-pulse-in 0.7s ease-out both;
        }
        .hiw-icon-draw {
          animation: hiw-draw-in 0.6s ease-out both;
        }
        .hiw-connector-draw {
          animation: hiw-connector-appear 0.8s ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .hiw-icon-drop,
          .hiw-icon-pulse,
          .hiw-icon-draw,
          .hiw-connector-draw {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>
    </section>
  );
}
