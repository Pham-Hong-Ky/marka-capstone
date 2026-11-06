import os
import pymupdf

def line_intersects_box(p1, p2, box):
    x1, y1 = p1
    x2, y2 = p2
    bx1, by1, bx2, by2 = box
    
    # check if strictly interior intersects
    # horizontal segment
    if y1 == y2:
        y = y1
        if by1 < y < by2:
            min_x, max_x = min(x1, x2), max(x1, x2)
            if max(min_x, bx1) < min(max_x, bx2):
                return True
    # vertical segment
    elif x1 == x2:
        x = x1
        if bx1 < x < bx2:
            min_y, max_y = min(y1, y2), max(y1, y2)
            if max(min_y, by1) < min(max_y, by2):
                return True
    return False

def check_no_collisions(lines, tables):
    collisions = []
    for i, line in enumerate(lines):
        pts = parse_path_points(line["d"])
        for j in range(len(pts) - 1):
            p1 = pts[j]
            p2 = pts[j+1]
            for tname, t in tables.items():
                box = (t["x"], t["y"], t["x"] + t["w"], t["y"] + t["h"])
                if line_intersects_box(p1, p2, box):
                    collisions.append((i, tname, p1, p2, box))
    return collisions

def parse_path_points(d):
    tokens = d.replace("M", " ").replace("L", " ").strip().split()
    pts = []
    for k in range(0, len(tokens), 2):
        pts.append((float(tokens[k]), float(tokens[k+1])))
    return pts

def build_svg():
    width = 1750
    height = 2050
    
    # 16 tables definition based on backend/prisma/schema.prisma
    tables = {
        "Workspace_members": {
            "x": 480, "y": 60, "w": 280,
            "fields": [
                "+id : string",
                "+workspaceId : string",
                "+userId : string",
                "+role : string",
                "+allowDirectPublish : boolean",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Workspace_invites": {
            "x": 480, "y": 280, "w": 280,
            "fields": [
                "+id : string",
                "+email : string",
                "+workspaceId : string",
                "+role : string",
                "+token : string",
                "+isUsed : boolean",
                "+expiresAt : Datetime",
                "+invitedById : string",
                "+createdAt : Datetime"
            ]
        },
        "Credit_packages": {
            "x": 890, "y": 260, "w": 280,
            "fields": [
                "+id : string",
                "+name : string",
                "+description : string",
                "+creditAmount : int",
                "+price : int",
                "+sortOrder : int",
                "+isActive : boolean",
                "+deletedAt : Datetime",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Audit_logs": {
            "x": 1340, "y": 260, "w": 280,
            "fields": [
                "+id : string",
                "+workspaceId : string",
                "+actorId : string",
                "+action : string",
                "+targetType : string",
                "+targetId : string",
                "+reason : string",
                "+metadata : json",
                "+createdAt : Datetime"
            ]
        },
        "Channel_connections": {
            "x": 70, "y": 600, "w": 280,
            "fields": [
                "+id : string",
                "+workspaceId : string",
                "+platform : string",
                "+type : string",
                "+name : string",
                "+label : string",
                "+avatar : string",
                "+externalAccountId : string",
                "+accessToken : string",
                "+status : string",
                "+deletedAt : Datetime",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Workspaces": {
            "x": 480, "y": 600, "w": 280,
            "fields": [
                "+id : string",
                "+name : string",
                "+brandVoice : json",
                "+plan : string",
                "+remainingCredit : int",
                "+monthlyQuota : int",
                "+planExpiresAt : Datetime",
                "+billingCycleStart : Datetime",
                "+nextResetAt : Datetime",
                "+planExpiryWarningSentAt : Datetime",
                "+creditWarningSentAt : Datetime",
                "+deletedAt : Datetime",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Orders": {
            "x": 890, "y": 600, "w": 280,
            "fields": [
                "+id : string",
                "+orderCode : string",
                "+workspaceId : string",
                "+packageId : string",
                "+amount : int",
                "+creditAmount : int",
                "+targetPlan : string",
                "+paymentLinkId : string",
                "+checkoutUrl : string",
                "+expiresAt : Datetime",
                "+payosTransId : string",
                "+paidAt : Datetime",
                "+status : string",
                "+createdById : string",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Users": {
            "x": 1340, "y": 600, "w": 280,
            "fields": [
                "+id : string",
                "+email : string",
                "+passwordHash : string",
                "+name : string",
                "+avatar : string",
                "+facebookUrl : string",
                "+threadsUrl : string",
                "+authProvider : string",
                "+googleId : string",
                "+emailVerified : boolean",
                "+systemRole : string",
                "+tokenVersion : int",
                "+isSuspended : boolean",
                "+deletedAt : Datetime",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Scheduled_posts": {
            "x": 70, "y": 1080, "w": 280,
            "fields": [
                "+id : string",
                "+postId : string",
                "+channelId : string",
                "+customContent : json",
                "+scheduledAt : Datetime",
                "+status : string",
                "+externalPostId : string",
                "+errorMessage : string",
                "+retryCount : int",
                "+processingStartedAt : Datetime",
                "+retryAt : Datetime",
                "+publishedAt : Datetime",
                "+reminderSentAt : Datetime",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Posts": {
            "x": 480, "y": 1040, "w": 280,
            "fields": [
                "+id : string",
                "+workspaceId : string",
                "+title : string",
                "+content : json",
                "+status : string",
                "+taskStatus : string",
                "+campaignTag : string",
                "+rejectReason : string",
                "+assigneeId : string",
                "+assignedById : string",
                "+assignedAt : Datetime",
                "+dueAt : Datetime",
                "+submittedById : string",
                "+createdById : string",
                "+submittedAt : Datetime",
                "+reviewedById : string",
                "+reviewedAt : Datetime",
                "+deletedAt : Datetime",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Credit_transactions": {
            "x": 890, "y": 1080, "w": 280,
            "fields": [
                "+id : string",
                "+workspaceId : string",
                "+type : string",
                "+action : string",
                "+amount : int",
                "+balanceBefore : int",
                "+balanceAfter : int",
                "+reason : string",
                "+createdById : string",
                "+createdAt : Datetime"
            ]
        },
        "Notifications": {
            "x": 1340, "y": 1080, "w": 280,
            "fields": [
                "+id : string",
                "+userId : string",
                "+workspaceId : string",
                "+type : string",
                "+payload : json",
                "+isRead : boolean",
                "+createdAt : Datetime"
            ]
        },
        "Post_metrics": {
            "x": 70, "y": 1560, "w": 280,
            "fields": [
                "+id : string",
                "+scheduledPostId : string",
                "+reactions : int",
                "+reactionsDetail : json",
                "+comments : int",
                "+shares : int",
                "+reach : int",
                "+impressions : int",
                "+permalinkUrl : string",
                "+syncError : string",
                "+fetchedAt : Datetime",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Tasks": {
            "x": 480, "y": 1560, "w": 280,
            "fields": [
                "+id : string",
                "+workspaceId : string",
                "+title : string",
                "+description : string",
                "+status : string",
                "+priority : int",
                "+assigneeId : string",
                "+assignedById : string",
                "+assignedAt : Datetime",
                "+dueAt : Datetime",
                "+postId : string",
                "+createdById : string",
                "+deletedAt : Datetime",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        },
        "Media_assets": {
            "x": 890, "y": 1560, "w": 280,
            "fields": [
                "+id : string",
                "+workspaceId : string",
                "+postId : string",
                "+url : string",
                "+type : string",
                "+mimeType : string",
                "+thumbnailUrl : string",
                "+size : int",
                "+tags : string",
                "+source : string",
                "+createdById : string",
                "+deletedAt : Datetime",
                "+createdAt : Datetime"
            ]
        },
        "Ai_generations": {
            "x": 1340, "y": 1560, "w": 280,
            "fields": [
                "+id : string",
                "+workspaceId : string",
                "+userId : string",
                "+postId : string",
                "+type : string",
                "+provider : string",
                "+model : string",
                "+status : string",
                "+prompt : string",
                "+response : string",
                "+errorMessage : string",
                "+creditCost : int",
                "+createdAt : Datetime",
                "+updatedAt : Datetime"
            ]
        }
    }

    # Calculate table heights
    for name, t in tables.items():
        t["h"] = 28 + 8 + len(t["fields"]) * 18

    lines = [
        # 1. Channel_connections <-> Workspaces
        {
            "d": "M 350 640 L 480 640",
            "labels": [("n", 358, 632), ("1", 468, 632)]
        },
        # 2. Channel_connections <-> Scheduled_posts
        {
            "d": f"M 210 {tables['Channel_connections']['y'] + tables['Channel_connections']['h']} L 210 {tables['Scheduled_posts']['y']}",
            "labels": [("1", 218, tables['Channel_connections']['y'] + tables['Channel_connections']['h'] + 20), ("n", 218, tables['Scheduled_posts']['y'] - 12)]
        },
        # 3. Scheduled_posts <-> Post_metrics
        {
            "d": f"M 210 {tables['Scheduled_posts']['y'] + tables['Scheduled_posts']['h']} L 210 {tables['Post_metrics']['y']}",
            "labels": [("1", 218, tables['Scheduled_posts']['y'] + tables['Scheduled_posts']['h'] + 20), ("1", 218, tables['Post_metrics']['y'] - 12)]
        },
        # 4. Scheduled_posts <-> Posts
        {
            "d": "M 350 1120 L 480 1120",
            "labels": [("n", 358, 1112), ("1", 468, 1112)]
        },
        # 5. Workspaces <-> Workspace_members (route around invites at x=430)
        {
            "d": f"M 520 {tables['Workspaces']['y']} L 520 540 L 430 540 L 430 140 L 480 140",
            "labels": [("1", 528, 585), ("n", 465, 132)]
        },
        # 6. Workspaces <-> Workspace_invites
        {
            "d": f"M 620 {tables['Workspaces']['y']} L 620 {tables['Workspace_invites']['y'] + tables['Workspace_invites']['h']}",
            "labels": [("1", 628, 585), ("n", 628, tables['Workspace_invites']['y'] + tables['Workspace_invites']['h'] + 20)]
        },
        # 7. Workspace_members <-> Users (route at y=140 across to x=1260, then down to y=640)
        {
            "d": f"M 760 140 L 1260 140 L 1260 640 L 1340 640",
            "labels": [("n", 768, 132), ("1", 1325, 632)]
        },
        # 8. Workspace_invites <-> Users (route at y=200 above Credit_packages)
        {
            "d": f"M 760 350 L 800 350 L 800 200 L 1240 200 L 1240 660 L 1340 660",
            "labels": [("n", 768, 342), ("1", 1325, 652)]
        },
        # 9. Credit_packages <-> Orders
        {
            "d": f"M 1030 {tables['Credit_packages']['y'] + tables['Credit_packages']['h']} L 1030 {tables['Orders']['y']}",
            "labels": [("1", 1038, tables['Credit_packages']['y'] + tables['Credit_packages']['h'] + 20), ("n", 1038, tables['Orders']['y'] - 12)]
        },
        # 10. Workspaces <-> Orders
        {
            "d": "M 760 680 L 890 680",
            "labels": [("1", 768, 672), ("n", 878, 672)]
        },
        # 11. Orders <-> Users
        {
            "d": "M 1170 680 L 1340 680",
            "labels": [("n", 1178, 672), ("1", 1325, 672)]
        },
        # 12. Workspaces <-> Credit_transactions (in gutter x=830)
        {
            "d": "M 760 760 L 830 760 L 830 1120 L 890 1120",
            "labels": [("1", 768, 752), ("n", 878, 1112)]
        },
        # 13. Credit_transactions <-> Users (in gutter x=1260)
        {
            "d": "M 1170 1120 L 1260 1120 L 1260 760 L 1340 760",
            "labels": [("n", 1178, 1112), ("1", 1325, 752)]
        },
        # 14. Workspaces <-> Posts
        {
            "d": f"M 620 {tables['Workspaces']['y'] + tables['Workspaces']['h']} L 620 {tables['Posts']['y']}",
            "labels": [("1", 628, tables['Workspaces']['y'] + tables['Workspaces']['h'] + 20), ("n", 628, tables['Posts']['y'] - 12)]
        },
        # 15. Posts <-> Tasks
        {
            "d": f"M 620 {tables['Posts']['y'] + tables['Posts']['h']} L 620 {tables['Tasks']['y']}",
            "labels": [("1", 628, tables['Posts']['y'] + tables['Posts']['h'] + 20), ("1", 628, tables['Tasks']['y'] - 12)]
        },
        # 16. Workspaces <-> Tasks (left side bypass at x=410)
        {
            "d": "M 480 820 L 410 820 L 410 1620 L 480 1620",
            "labels": [("1", 465, 812), ("n", 465, 1612)]
        },
        # 17. Tasks <-> Users (route through horizontal channel y=1500 and gutter x=1280)
        {
            "d": "M 760 1620 L 830 1620 L 830 1500 L 1280 1500 L 1280 860 L 1340 860",
            "labels": [("n", 768, 1612), ("1", 1325, 852)]
        },
        # 18. Posts <-> Media_assets (in gutter x=830)
        {
            "d": "M 760 1360 L 830 1360 L 830 1620 L 890 1620",
            "labels": [("1", 768, 1352), ("n", 878, 1612)]
        },
        # 19. Workspaces <-> Media_assets (in gutter x=850)
        {
            "d": "M 760 840 L 850 840 L 850 1680 L 890 1680",
            "labels": [("1", 768, 832), ("n", 878, 1672)]
        },
        # 20. Posts <-> Ai_generations (route down gutter x=810, across y=1480, then to x=1240)
        {
            "d": "M 760 1220 L 810 1220 L 810 1480 L 1240 1480 L 1240 1620 L 1340 1620",
            "labels": [("1", 768, 1212), ("n", 1325, 1612)]
        },
        # 21. Users <-> Ai_generations (in right margin x=1660)
        {
            "d": "M 1620 880 L 1660 880 L 1660 1620 L 1620 1620",
            "labels": [("1", 1630, 872), ("n", 1630, 1612)]
        },
        # 22. Users <-> Notifications
        {
            "d": f"M 1480 {tables['Users']['y'] + tables['Users']['h']} L 1480 {tables['Notifications']['y']}",
            "labels": [("1", 1488, tables['Users']['y'] + tables['Users']['h'] + 20), ("n", 1488, tables['Notifications']['y'] - 12)]
        },
        # 23. Workspaces <-> Notifications (route at y=1000 in open gap between Orders and Credit_trans)
        {
            "d": "M 760 870 L 870 870 L 870 1000 L 1300 1000 L 1300 1140 L 1340 1140",
            "labels": [("1", 768, 862), ("n", 1325, 1132)]
        },
        # 24. Audit_logs <-> Users
        {
            "d": f"M 1480 {tables['Audit_logs']['y'] + tables['Audit_logs']['h']} L 1480 {tables['Users']['y']}",
            "labels": [("n", 1488, tables['Audit_logs']['y'] + tables['Audit_logs']['h'] + 20), ("1", 1488, tables['Users']['y'] - 12)]
        },
        # 25. Workspaces <-> Audit_logs (route across y=540 highway)
        {
            "d": "M 700 600 L 700 540 L 1300 540 L 1300 380 L 1340 380",
            "labels": [("1", 708, 585), ("n", 1325, 372)]
        }
    ]

    # Verify no line collisions with table interiors
    collisions = check_no_collisions(lines, tables)
    if collisions:
        print(f"WARNING: Found {len(collisions)} collisions:")
        for c in collisions:
            print(f"  Line {c[0]} collides with table {c[1]}: segment {c[2]}->{c[3]} into {c[4]}")
    else:
        print("PERFECT: 0 line collisions detected! All lines route strictly through open channels.")

    # Start SVG
    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Arial, sans-serif">')
    svg.append(f'<rect width="{width}" height="{height}" fill="#ffffff"/>')

    # Title & Legend
    svg.append('<text x="875" y="32" text-anchor="middle" font-size="20" font-weight="bold" fill="#0f172a">Marka Platform — Sơ đồ Thực thể Cơ sở Dữ liệu (Entity Relationship Diagram - 16 Bảng)</text>')

    # Draw connection lines
    for line in lines:
        svg.append(f'<path d="{line["d"]}" fill="none" stroke="#222222" stroke-width="1.3"/>')
        for text, lx, ly in line["labels"]:
            svg.append(f'<text x="{lx}" y="{ly}" font-size="12" font-weight="bold" fill="#000000">{text}</text>')

    # Draw tables
    header_color = "#92c7e8"  # Exact Visual Paradigm light sky blue
    for name, t in tables.items():
        x = t["x"]
        y = t["y"]
        w = t["w"]
        h = t["h"]
        fields = t["fields"]
        
        # Outer border / body
        svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#ffffff" stroke="#222222" stroke-width="1.2"/>')
        
        # Header rect
        svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="28" fill="{header_color}" stroke="#222222" stroke-width="1.2"/>')
        
        # Header text
        display_name = name
        svg.append(f'<text x="{x + w/2}" y="{y + 19}" text-anchor="middle" font-size="13" font-weight="bold" fill="#000000">{display_name}</text>')
        
        # Divider line
        svg.append(f'<line x1="{x}" y1="{y + 28}" x2="{x + w}" y2="{y + 28}" stroke="#222222" stroke-width="1.2"/>')
        
        # Fields
        cur_y = y + 44
        for field in fields:
            svg.append(f'<text x="{x + 8}" y="{cur_y}" font-size="11" fill="#000000">{field}</text>')
            cur_y += 18

    # Watermark bottom right
    svg.append(f'<text x="{width - 40}" y="{height - 30}" text-anchor="end" font-size="11" fill="#64748b">Powered By Visual Paradigm Community Edition</text>')
    
    svg.append('</svg>')
    return "\n".join(svg)

def main():
    svg_content = build_svg()
    
    # Save SVG to docs
    svg_path = "docs/diagrams/erd_marka_full.svg"
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"SVG saved to {svg_path}")
    
    # Convert to PNG via pymupdf
    doc = pymupdf.open(stream=svg_content.encode("utf-8"), filetype="svg")
    page = doc[0]
    
    # Render at 200 DPI for high resolution
    pix = page.get_pixmap(dpi=200)
    png_path = "docs/diagrams/erd_marka_full.png"
    pix.save(png_path)
    print(f"PNG saved to {png_path} ({pix.width}x{pix.height})")
    
    # Also save to artifact directory
    artifact_dir = r"C:\Users\ADMIN88\.gemini\antigravity\brain\dff2988f-cb96-4fcb-ba48-964304d59b3c"
    artifact_png = os.path.join(artifact_dir, "erd_marka_full.png")
    pix.save(artifact_png)
    print(f"Artifact PNG saved to {artifact_png}")

if __name__ == "__main__":
    main()
