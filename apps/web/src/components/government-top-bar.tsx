import {
  useState,
} from "react";

/* =========================================================
 * LINKS INSTITUCIONAIS
 *
 * Caso a CGE possua URLs internas/específicas diferentes,
 * basta trocar somente os hrefs deste array.
 * ======================================================= */

const institutionalLinks = [
  {
    label:
      "PORTAL DA TRANSPARÊNCIA",

    href:
      "https://www.transparencia.am.gov.br/",
  },

  {
    label:
      "DIÁRIO OFICIAL",

    href:
      "https://diario.imprensaoficial.am.gov.br/",
  },

  {
    label:
      "ACESSO À INFORMAÇÃO",

    href:
      "https://www.transparencia.am.gov.br/",
  },

  {
    label:
      "OUVIDORIA",

    href:
      "https://www.ouvidoria.am.gov.br/",
  },

  {
    label:
      "RADAR DA TRANSPARÊNCIA",

    href:
      "https://radardatransparencia.atricon.org.br/",
  },
] as const;

/* =========================================================
 * GOVERNMENT TOP BAR
 * ======================================================= */

export function GovernmentTopBar() {
  const [
    fontLevel,
    setFontLevel,
  ] =
    useState(0);

  const [
    highContrast,
    setHighContrast,
  ] =
    useState(false);

  /* =======================================================
   * TAMANHO DA FONTE
   * ===================================================== */

  function applyFontLevel(
    level:
      number,
  ) {
    const normalized =
      Math.max(
        -1,
        Math.min(
          1,
          level,
        ),
      );

    setFontLevel(
      normalized,
    );

    /*
     * 0  = padrão
     * -1 = menor
     * +1 = maior
     */

    const size =
      normalized ===
      -1
        ? "15px"
        : normalized ===
            1
          ? "17px"
          : "16px";

    document
      .documentElement
      .style
      .setProperty(
        "font-size",
        size,
      );
  }

  /* =======================================================
   * CONTRASTE
   * ===================================================== */

  function toggleContrast() {
    const enabled =
      !highContrast;

    setHighContrast(
      enabled,
    );

    document
      .documentElement
      .style
      .setProperty(
        "filter",
        enabled
          ? "contrast(1.15)"
          : "",
      );
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-[80] h-[52px] border-b border-white/10 bg-[#063c43] text-white"
      aria-label="Barra institucional do Governo do Amazonas"
    >
      <div className="mx-auto flex h-full w-full max-w-[1120px] items-center px-3 sm:px-4">
        {/* =================================================
         * BRASÃO
         * =============================================== */}

        <a
          aria-label="Governo do Estado do Amazonas"
          className="mr-auto flex h-full shrink-0 items-center pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          href="https://www.amazonas.am.gov.br/"
          rel="noreferrer"
          target="_blank"
        >
          <img
            alt="Brasão do Estado do Amazonas"
            className="h-[34px] w-auto object-contain"
            src="/brand/brasao-amazonas.png"
          />
        </a>

        {/* =================================================
         * ÁREA CENTRAL
         *
         * Em telas menores permitimos scroll horizontal.
         * =============================================== */}

        <div className="gov-scroll flex min-w-0 flex-1 items-center justify-end overflow-x-auto">
          <div className="flex min-w-max items-center">
            {/* =============================================
             * ACESSIBILIDADE
             * =========================================== */}

            <nav
              aria-label="Recursos de acessibilidade"
              className="flex h-[30px] shrink-0 items-center"
            >
              {/* ACESSIBILIDADE VISUAL */}

              <button
                aria-label="Recursos de acessibilidade"
                className="gov-action"
                title="Acessibilidade"
                type="button"
              >
                <AccessibilityIcon />
              </button>

              {/* DIMINUIR FONTE */}

              <button
                aria-label="Diminuir tamanho da fonte"
                className={[
                  "gov-text-action",
                  fontLevel ===
                  -1
                    ? "bg-white/10"
                    : "",
                ].join(
                  " ",
                )}
                onClick={() =>
                  applyFontLevel(
                    -1,
                  )
                }
                title="Diminuir fonte"
                type="button"
              >
                A
                <span
                  aria-hidden="true"
                  className="ml-[1px] text-[10px]"
                >
                  −
                </span>
              </button>

              {/* CONTRASTE */}

              <button
                aria-label="Alternar alto contraste"
                aria-pressed={
                  highContrast
                }
                className={[
                  "gov-action",
                  highContrast
                    ? "bg-white/10"
                    : "",
                ].join(
                  " ",
                )}
                onClick={
                  toggleContrast
                }
                title="Alto contraste"
                type="button"
              >
                <ContrastIcon />
              </button>

              {/* AUMENTAR FONTE */}

              <button
                aria-label="Aumentar tamanho da fonte"
                className={[
                  "gov-text-action",
                  fontLevel ===
                  1
                    ? "bg-white/10"
                    : "",
                ].join(
                  " ",
                )}
                onClick={() =>
                  applyFontLevel(
                    1,
                  )
                }
                title="Aumentar fonte"
                type="button"
              >
                A+
              </button>

              {/* FONTE PADRÃO */}

              <button
                aria-label="Restaurar tamanho padrão da fonte"
                className={[
                  "gov-text-action",
                  fontLevel ===
                  0
                    ? "bg-white/5"
                    : "",
                ].join(
                  " ",
                )}
                onClick={() =>
                  applyFontLevel(
                    0,
                  )
                }
                title="Fonte padrão"
                type="button"
              >
                A
              </button>

              {/* DIMINUIR */}

              <button
                aria-label="Diminuir tamanho da fonte"
                className="gov-text-action"
                onClick={() =>
                  applyFontLevel(
                    -1,
                  )
                }
                title="Diminuir fonte"
                type="button"
              >
                A−
              </button>

              {/* MAPA */}

              <button
                aria-label="Mapa do site"
                className="gov-action"
                title="Mapa do site"
                type="button"
              >
                <SiteMapIcon />
              </button>
            </nav>

            {/* =============================================
             * SEPARADOR
             * =========================================== */}

            <div
              aria-hidden="true"
              className="mx-3 h-[28px] w-px shrink-0 bg-white/35"
            />

            {/* =============================================
             * LINKS GOVERNAMENTAIS
             * =========================================== */}

            <nav
              aria-label="Links institucionais"
              className="flex h-[34px] shrink-0 items-center"
            >
              {institutionalLinks.map(
                (
                  item,
                  index,
                ) => (
                  <a
                    className="gov-institutional-link"
                    href={
                      item.href
                    }
                    key={
                      item.label
                    }
                    rel="noreferrer"
                    target="_blank"
                  >
                    {index ===
                    2 ? (
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-grid size-[18px] shrink-0 place-items-center rounded-full bg-[#168bb2] text-[9px]"
                      >
                        i
                      </span>
                    ) : null}

                    {index ===
                    3 ? (
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-flex items-center"
                      >
                        <MegaphoneIcon />
                      </span>
                    ) : null}

                    {index ===
                    4 ? (
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-flex items-center"
                      >
                        <RadarIcon />
                      </span>
                    ) : null}

                    <span>
                      {
                        item.label
                      }
                    </span>
                  </a>
                ),
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* ===================================================
       * CSS LOCAL
       *
       * Mantemos a barra isolada para não interferir
       * no design system da Intranet.
       * ================================================= */}

      <style>
        {`
          .gov-scroll {
            scrollbar-width: none;
          }

          .gov-scroll::-webkit-scrollbar {
            display: none;
          }

          .gov-action {
            display: inline-grid;
            place-items: center;
            min-width: 30px;
            height: 30px;
            padding: 0 6px;
            border-radius: 4px;
            color: rgba(255,255,255,.96);
            transition:
              background-color 140ms ease,
              color 140ms ease;
          }

          .gov-action:hover {
            background: rgba(255,255,255,.10);
          }

          .gov-action:focus-visible {
            outline: 2px solid rgba(255,255,255,.95);
            outline-offset: 1px;
          }

          .gov-text-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 30px;
            height: 30px;
            padding: 0 5px;
            border-radius: 4px;
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            line-height: 1;
            white-space: nowrap;
            transition: background-color 140ms ease;
          }

          .gov-text-action:hover {
            background: rgba(255,255,255,.10);
          }

          .gov-text-action:focus-visible {
            outline: 2px solid rgba(255,255,255,.95);
            outline-offset: 1px;
          }

          .gov-institutional-link {
            display: inline-flex;
            align-items: center;
            min-height: 30px;
            padding: 0 9px;
            color: rgba(255,255,255,.98);
            font-size: 9px;
            font-weight: 700;
            line-height: 1.15;
            text-decoration: none;
            text-transform: uppercase;
            white-space: nowrap;
            transition:
              background-color 140ms ease,
              color 140ms ease;
          }

          .gov-institutional-link:hover {
            background: rgba(255,255,255,.08);
            color: #fff;
          }

          .gov-institutional-link:focus-visible {
            outline: 2px solid rgba(255,255,255,.95);
            outline-offset: -1px;
          }

          @media (max-width: 900px) {
            .gov-institutional-link {
              font-size: 8px;
              padding-inline: 7px;
            }
          }
        `}
      </style>
    </header>
  );
}

/* =========================================================
 * ICONS
 *
 * SVG inline evita dependência adicional e permite chegar
 * mais perto da referência visual.
 * ======================================================= */

function AccessibilityIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M12 4.2c4.2 0 7.4 3.1 9 7.8-1.6 4.7-4.8 7.8-9 7.8S4.6 16.7 3 12c1.6-4.7 4.8-7.8 9-7.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="12"
        cy="12"
        r="2.7"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M5 4 19 20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ContrastIcon() {
  return (
    <svg
      aria-hidden="true"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <circle
        cx="12"
        cy="12"
        fill="none"
        r="8"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M12 4a8 8 0 0 0 0 16V4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SiteMapIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="19"
      viewBox="0 0 24 24"
      width="19"
    >
      <rect
        height="4"
        rx="0.7"
        stroke="currentColor"
        strokeWidth="1.5"
        width="5"
        x="9.5"
        y="3"
      />

      <rect
        height="4"
        rx="0.7"
        stroke="currentColor"
        strokeWidth="1.5"
        width="5"
        x="2"
        y="17"
      />

      <rect
        height="4"
        rx="0.7"
        stroke="currentColor"
        strokeWidth="1.5"
        width="5"
        x="9.5"
        y="17"
      />

      <rect
        height="4"
        rx="0.7"
        stroke="currentColor"
        strokeWidth="1.5"
        width="5"
        x="17"
        y="17"
      />

      <path
        d="M12 7v5m0 0H4.5v5M12 12v5m0-5h7.5v5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path
        d="M4 13.5v-3L16.5 5v14L4 13.5Z"
        fill="#e7c22e"
      />

      <path
        d="M7 14.5 8.4 19h3.2l-1.2-3.4"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path
        d="M12 4a8 8 0 1 0 8 8"
        stroke="#e7c22e"
        strokeWidth="1.6"
      />

      <path
        d="M12 12 19 7"
        stroke="#e7c22e"
        strokeLinecap="round"
        strokeWidth="1.8"
      />

      <circle
        cx="12"
        cy="12"
        fill="#e7c22e"
        r="1.7"
      />
    </svg>
  );
}