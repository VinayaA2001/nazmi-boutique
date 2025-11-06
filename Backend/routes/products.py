from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
import re

products_bp = Blueprint("products", __name__)

CLOUD_BASE = "https://res.cloudinary.com/dq5xhg9uo/image/upload/"

# ---------- Helpers ----------

def is_object_id(s: str) -> bool:
    try:
        ObjectId(s)
        return True
    except Exception:
        return False


def abs_url(u: str) -> str:
    if not u:
        return ""
    u = str(u).strip()
    if u.startswith("http://") or u.startswith("https://"):
        return u
    return CLOUD_BASE + u.lstrip("/")


def normalize_product(doc: dict) -> dict:
    """Shape the product to what the Next.js UI expects."""
    if not doc:
        return {}

    doc["_id"] = str(doc.get("_id", ""))

    imgs = doc.get("images") or []
    if isinstance(imgs, list):
        doc["images"] = [abs_url(x) for x in imgs if x]
    else:
        doc["images"] = []

    variants = doc.get("variants") or []
    norm_variants = []
    avail_sizes = set()
    avail_colors = set()
    prices = []
    total_stock = 0

    for v in variants if isinstance(variants, list) else []:
        vv = {
            "_id": str(v.get("_id", "")),
            "size": (v.get("size") or "").strip(),
            "colour": (v.get("colour") or v.get("color") or "").strip(),
            "stock": int(v.get("stock") or 0),
            "price": float(v.get("price") or 0),
            "images": [],
        }

        vimgs = v.get("images") or []
        if isinstance(vimgs, list) and vimgs:
            vv["images"] = [abs_url(x) for x in vimgs if x]

        if vv["size"]:
            avail_sizes.add(vv["size"])
        if vv["colour"]:
            avail_colors.add(vv["colour"])
        if vv["price"] > 0:
            prices.append(vv["price"])
        total_stock += max(0, vv["stock"])

        norm_variants.append(vv)

    # price band logic
    if "minPrice" in doc and isinstance(doc["minPrice"], (int, float)) and doc["minPrice"] > 0:
        min_price = float(doc["minPrice"])
    else:
        min_price = float(min(prices)) if prices else float(doc.get("price") or 0)

    if "maxPrice" in doc and isinstance(doc["maxPrice"], (int, float)) and doc["maxPrice"] > 0:
        max_price = float(doc["maxPrice"])
    else:
        max_price = float(max(prices)) if prices else float(min_price)

    provided_sizes = doc.get("availableSizes") or []
    provided_colors = doc.get("availableColors") or []

    doc["availableSizes"] = provided_sizes if provided_sizes else sorted(avail_sizes)
    doc["availableColors"] = provided_colors if provided_colors else sorted(avail_colors)
    doc["variants"] = norm_variants
    doc["totalStock"] = int(doc.get("totalStock") or total_stock)
    doc["minPrice"] = min_price
    doc["maxPrice"] = max_price

    doc["product_name"] = doc.get("product_name") or ""
    doc["material"] = doc.get("material") or ""
    doc["category"] = doc.get("category") or ""
    doc["product_code"] = doc.get("product_code") or ""
    doc["description"] = doc.get("description") or ""

    return doc


# ---------- ROUTES ----------

@products_bp.route("/api/products", methods=["GET"])
def get_products():
    try:
        db = current_app.mongo.db

        category = request.args.get("category", type=str)
        search = request.args.get("search", type=str)
        limit = request.args.get("limit", default=0, type=int)
        skip = request.args.get("skip", default=0, type=int)

        query = {}

        # ✅ Fix category filter to match "contains" instead of exact
        if category:
            query["category"] = {"$regex": re.escape(category), "$options": "i"}

        # Search filter
        if search:
            rx = {"$regex": re.escape(search), "$options": "i"}
            query["$or"] = [
                {"product_name": rx},
                {"material": rx},
                {"category": rx},
                {"product_code": rx},
                {"description": rx},
            ]

        cursor = db.products.find(query).skip(skip)
        if limit and limit > 0:
            cursor = cursor.limit(limit)

        docs = list(cursor)
        products = [normalize_product(d) for d in docs]

        return jsonify({"products": products})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Route: GET by slug
@products_bp.route("/api/products/slug/<slug>", methods=["GET"])
def get_product_by_slug(slug):
    try:
        db = current_app.mongo.db

        doc = db.products.find_one(
            {
                "$or": [
                    {"slug": {"$regex": f"^{re.escape(slug)}$", "$options": "i"}},
                    {"product_code": {"$regex": f"^{re.escape(slug)}$", "$options": "i"}},
                ]
            }
        )

        if not doc:
            return jsonify({"error": "Product not found"}), 404

        return jsonify({"product": normalize_product(doc)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Route: GET by ID or slug
@products_bp.route("/api/products/<key>", methods=["GET"])
def get_product(key):
    try:
        db = current_app.mongo.db

        doc = None

        if is_object_id(key):
            doc = db.products.find_one({"_id": ObjectId(key)})

        if not doc:
            doc = db.products.find_one(
                {
                    "$or": [
                        {"slug": {"$regex": f"^{re.escape(key)}$", "$options": "i"}},
                        {"product_code": {"$regex": f"^{re.escape(key)}$", "$options": "i"}},
                    ]
                }
            )

        if not doc:
            return jsonify({"error": "Product not found"}), 404

        return jsonify({"product": normalize_product(doc)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
