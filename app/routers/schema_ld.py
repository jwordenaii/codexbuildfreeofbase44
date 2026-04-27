import os
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/schema", tags=["schema"])

# All contact/location fields read from environment variables so that
# the backend can be deployed once and configured per environment without
# touching source code.  The TODO values here are the fallback strings
# that make the dev server useful out-of-the-box.

def _build_schema() -> dict:
    return {
        "@context": "https://schema.org",
        "@type": ["PavingContractor", "LocalBusiness"],
        "name": "J. Worden & Sons Asphalt Paving",
        "alternateName": "JWordenAI",
        "description": (
            "Fourth-generation asphalt paving company serving residential and commercial "
            "clients since 1984. Specialists in asphalt paving, sealcoating, crack filling, "
            "parking lots, and driveways."
        ),
        "foundingDate": "1984",
        "telephone": os.getenv("BUSINESS_PHONE", "+18044461296"),
        "email": os.getenv("BUSINESS_EMAIL", "contact@jwordenasphaltpaving.com"),
        "url": os.getenv("SITE_URL", "https://jwordenasphaltpaving.com"),
        "logo": os.getenv("SITE_URL", "https://jwordenasphaltpaving.com") + "/logo.png",
        "image": os.getenv("SITE_URL", "https://jwordenasphaltpaving.com") + "/hero.jpg",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": os.getenv("BUSINESS_STREET", "1601 Ware Bottom Springs Rd Suite 214"),
            "addressLocality": os.getenv("BUSINESS_CITY", "Chester"),
            "addressRegion": os.getenv("BUSINESS_STATE", "VA"),
            "postalCode": os.getenv("BUSINESS_ZIP", "23836"),
            "addressCountry": "US",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": float(os.getenv("BUSINESS_LAT", "37.3529")),
            "longitude": float(os.getenv("BUSINESS_LNG", "-77.4326")),
        },
        "openingHoursSpecification": [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "opens": "07:00",
                "closes": "17:00",
            }
        ],
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "bestRating": "5",
            "worstRating": "1",
            "reviewCount": "87",
        },
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Asphalt Services",
            "itemListElement": [
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Asphalt Paving",
                        "description": "New asphalt paving for driveways, parking lots, and roads.",
                    },
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Sealcoating",
                        "description": "Protective sealcoating to extend asphalt lifespan.",
                    },
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Crack Filling",
                        "description": "Professional crack fill and repair for existing asphalt.",
                    },
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Parking Lot Construction",
                        "description": "Full-service commercial parking lot design and installation.",
                    },
                },
            ],
        },
        "sameAs": [
            os.getenv("GOOGLE_MAPS_URL", "https://www.google.com/maps/place/J.+Worden+%26+Sons+Asphalt+Paving"),
        ],
    }


@router.get("/local-business", summary="JSON-LD LocalBusiness schema")
def get_local_business_schema():
    """
    Returns the Schema.org JSON-LD object for the company.
    All contact / location values are read from environment variables so
    deployments can be configured without code changes.
    Frontend injects this directly into <script type='application/ld+json'>.
    """
    return _build_schema()
