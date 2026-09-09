import nyracLogo from "../assets/nyrac-logo-tight.png.asset.json";
import realmLogo from "../assets/realm-logo.jpg.asset.json";
import deSportsLogo from "../assets/de-sports-entertainment-logo.jpg.asset.json";
import collectiveLogo from "../assets/collective-logo-black.png.asset.json";

type Affiliation = { name: string; logo?: string; alt?: string; caption?: string };

const AFFILIATIONS: Affiliation[] = [
  { name: "NYRAC", logo: nyracLogo.url, alt: "NYRAC logo: the letters NYRAC above the words New York Residential Agent Continuum.", caption: "Founding Co-Chair & Executive Committee Member." },
  { name: "REALM", logo: realmLogo.url, alt: "REALM logo: the REALM wordmark set in serif capitals." },
  { name: "DE Sports & Entertainment", logo: deSportsLogo.url, alt: "Douglas Elliman Sports & Entertainment logo: the DE circle monogram beside the Douglas Elliman wordmark, with Sports & Entertainment below." },
  { name: "Luxury Presence Collective", logo: collectiveLogo.url, alt: "Collective by Luxury Presence logo: a stylized keyhole mark beside the word COLLECTIVE, with BY LUXURY PRESENCE below." },
];

const IconInstagram = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M12 2c2.72 0 3.06.01 4.12.06 1.07.05 1.79.22 2.43.47.66.25 1.22.59 1.77 1.15.56.55.9 1.11 1.15 1.77.25.64.42 1.36.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.07-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.77c-.55.56-1.11.9-1.77 1.15-.64.25-1.36.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.07-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.64-.42-1.36-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.07.22-1.79.47-2.43.25-.66.59-1.22 1.15-1.77.55-.56 1.11-.9 1.77-1.15.64-.25 1.36-.42 2.43-.47C8.94 2.01 9.28 2 12 2Zm0 1.8c-2.67 0-2.99.01-4.04.06-.98.04-1.5.2-1.86.34-.47.18-.8.4-1.15.75-.35.35-.57.68-.75 1.15-.14.36-.3.88-.34 1.86-.05 1.05-.06 1.37-.06 4.04s.01 2.99.06 4.04c.04.98.2 1.5.34 1.86.18.47.4.8.75 1.15.35.35.68.57 1.15.75.36.14.88.3 1.86.34 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.98-.04 1.5-.2 1.86-.34.47-.18.8-.4 1.15-.75.35-.35.57-.68.75-1.15.14-.36.3-.88.34-1.86.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.98-.2-1.5-.34-1.86a3.1 3.1 0 0 0-.75-1.15 3.1 3.1 0 0 0-1.15-.75c-.36-.14-.88-.3-1.86-.34-1.05-.05-1.37-.06-4.04-.06Zm0 3.07a5.13 5.13 0 1 1 0 10.26 5.13 5.13 0 0 1 0-10.26Zm0 1.8a3.33 3.33 0 1 0 0 6.66 3.33 3.33 0 0 0 0-6.66Zm5.34-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
  </svg>
);

const IconLinkedIn = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M3.5 2h17A1.5 1.5 0 0 1 22 3.5v17a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 20.5v-17A1.5 1.5 0 0 1 3.5 2ZM8.1 18.5V10H5.4v8.5h2.7Zm-1.35-9.7a1.57 1.57 0 1 0 0-3.14 1.57 1.57 0 0 0 0 3.14ZM18.6 18.5v-4.66c0-2.5-1.33-3.66-3.11-3.66-1.44 0-2.08.79-2.44 1.35V10H10.4c.04.76 0 8.5 0 8.5h2.65v-4.75c0-.24.02-.48.09-.65.19-.47.63-.96 1.36-.96.96 0 1.35.73 1.35 1.8v4.56h2.75Z" />
  </svg>
);

const IconYouTube = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.28 5 12 5 12 5s-6.28 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.72 19 12 19 12 19s6.28 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z" />
  </svg>
);

const IconFacebook = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
  </svg>
);

export function AffiliationsConnect() {
  return (
    <>
      <section className="affiliations-section" aria-label="Affiliations">
        <div className="affiliations">
          {AFFILIATIONS.map((a) => (
            <div key={a.name} className="affiliations__item">
              {a.logo ? (
                <img className="affiliations__logo" src={a.logo} alt={a.alt ?? `${a.name} logo`} loading="lazy" />
              ) : (
                <span className="affiliations__wordmark">{a.name}</span>
              )}
              {a.caption ? <span className="affiliations__caption">{a.caption}</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="connect-section" aria-labelledby="connect-h">
        <h2 className="page-eyebrow" id="connect-h">Connect</h2>
        <div className="connect-row">
          <a className="connect-link" href="https://www.instagram.com/heatherdomi.nyc" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram /></a>
          <a className="connect-link" href="https://www.linkedin.com/in/heatherlmcdonough/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><IconLinkedIn /></a>
          <a className="connect-link" href="https://www.youtube.com/@HeatherDomiTeam" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><IconYouTube /></a>
          <a className="connect-link" href="https://www.facebook.com/profile.php?id=61584247604736&sk=reels_tab" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IconFacebook /></a>
        </div>
      </section>
    </>
  );
}
