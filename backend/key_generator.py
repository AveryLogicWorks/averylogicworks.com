#!/usr/bin/env python3
"""
Avery Logic Works — Command Nexus License Key Generator
=======================================================
Generates license keys for all customer-facing tiers.
Uses the same HMAC-SHA256 algorithm as the in-app validator
and the Supabase validate-key edge function.

Key format: TIER(2) + EXPIRY_HEX(10) + RANDOM(8) + HMAC(16) = 36 chars

Usage:
  python key_generator.py                    # Interactive mode
  python key_generator.py --tier TR          # Generate a 15-day trial key
  python key_generator.py --tier PR --days 365  # Generate a 1-year Pro key
  python key_generator.py --batch 10 --tier BU  # Generate 10 Business keys

Tiers:
  TR  Trial           ($10, 15 days)
  ST  Starter         ($20/mo, 30 days)
  PR  Pro             ($30/mo, 30 days, or $324/yr)
  BU  Business        ($50/mo, 30 days, or $552/yr)
  UN  Unlimited       ($80/mo, 30 days, or $900/yr)
  TE  Enterprise Eval (15 days, full access)
  EP  Enterprise Property (negotiated)
  EC  Enterprise Corporate (negotiated)
"""

import argparse
import hashlib
import hmac
import os
import secrets
import sys
from datetime import datetime, timedelta

SECRET_KEY = b"AVERY_LOGIC_WORKS_COMMAND_NEXUS_2026"

TIER_INFO = {
    "TR": {"name": "Trial",            "default_days": 15,  "price": "$10 (one-time, 15 days)"},
    "ST": {"name": "Starter",          "default_days": 30,  "price": "$20/mo"},
    "PR": {"name": "Pro",              "default_days": 30,  "price": "$30/mo or $324/yr"},
    "BU": {"name": "Business",         "default_days": 30,  "price": "$50/mo or $552/yr"},
    "UN": {"name": "Unlimited",        "default_days": 30,  "price": "$80/mo or $900/yr"},
    "TE": {"name": "Enterprise Eval",  "default_days": 15,  "price": "Free evaluation (15 days)"},
    "EP": {"name": "Enterprise Property",   "default_days": 365, "price": "Negotiated"},
    "EC": {"name": "Enterprise Corporate", "default_days": 365, "price": "Negotiated"},
}


def generate_key(tier_code: str, days: int | None = None) -> str:
    """Generate a single license key."""
    tier_code = tier_code.upper()
    if tier_code not in TIER_INFO:
        raise ValueError(f"Unknown tier: {tier_code}")

    info = TIER_INFO[tier_code]
    duration = days if days is not None else info["default_days"]

    expiry_ts = int((datetime.now() + timedelta(days=duration)).timestamp())
    expiry_hex = f"{expiry_ts:010x}"
    random_part = secrets.token_hex(4).upper()

    payload = f"{tier_code}{expiry_hex}{random_part}"
    hmac_sig = hmac.new(
        SECRET_KEY,
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:16].upper()

    key = f"{tier_code}{expiry_hex}{random_part}{hmac_sig}"
    assert len(key) == 36, f"Key length is {len(key)}, expected 36"

    return key


def format_key(key: str) -> str:
    """Format key as XXXX-XXXX groups for readability."""
    return "-".join(key[i:i + 4] for i in range(0, len(key), 4))


def main():
    parser = argparse.ArgumentParser(
        description="Command Nexus License Key Generator"
    )
    parser.add_argument(
        "--tier", type=str, default=None,
        help="Tier code (TR, ST, PR, BU, UN, TE, EP, EC)"
    )
    parser.add_argument(
        "--days", type=int, default=None,
        help="Override default duration in days"
    )
    parser.add_argument(
        "--batch", type=int, default=1,
        help="Number of keys to generate"
    )
    parser.add_argument(
        "--no-format", action="store_true",
        help="Output raw 36-char keys without dashes"
    )
    parser.add_argument(
        "--csv", type=str, default=None,
        help="Save keys to a CSV file"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  Command Nexus — License Key Generator")
    print("  Avery Logic Works")
    print("=" * 60)
    print()

    if args.tier is None:
        # Interactive mode
        print("Available tiers:")
        for code, info in TIER_INFO.items():
            print(f"  {code}  {info['name']:<22} {info['price']}")
        print()
        tier_code = input("Enter tier code: ").strip().upper()
    else:
        tier_code = args.tier.upper()

    if tier_code not in TIER_INFO:
        print(f"Error: Unknown tier '{tier_code}'")
        print(f"Valid tiers: {', '.join(TIER_INFO.keys())}")
        sys.exit(1)

    info = TIER_INFO[tier_code]
    days = args.days if args.days is not None else info["default_days"]

    print(f"Tier: {info['name']} ({tier_code})")
    print(f"Duration: {days} days")
    print(f"Price: {info['price']}")
    print(f"Count: {args.batch}")
    print()

    keys = []
    for i in range(args.batch):
        key = generate_key(tier_code, days)
        keys.append(key)
        display = key if args.no_format else format_key(key)
        expiry = datetime.fromtimestamp(int(key[2:12], 16))
        print(f"  Key {i + 1:>{len(str(args.batch))}}: {display}")
        print(f"         Expires: {expiry.strftime('%Y-%m-%d %H:%M:%S')}")

    if args.csv:
        import csv
        with open(args.csv, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["#", "Tier", "Key", "Formatted", "Expires", "Generated"])
            for i, key in enumerate(keys):
                expiry = datetime.fromtimestamp(int(key[2:12], 16))
                writer.writerow([
                    i + 1,
                    info["name"],
                    key,
                    format_key(key),
                    expiry.strftime("%Y-%m-%d %H:%M:%S"),
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                ])
        print(f"\nKeys saved to: {args.csv}")

    print()
    print("Keys are ready to distribute to customers.")
    print("Customers enter them at: averylogicworks.com/command-nexus.html#membership")


if __name__ == "__main__":
    main()
