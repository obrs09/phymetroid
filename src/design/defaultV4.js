/**
 * Baked schemaVersion 4 default from 数值策划 (authoritative dump).
 * Pages-safe JS module (no JSON import attributes).
 */
export default {
  "schemaVersion": 4,
  "layoutRevision": 5,
  "game": "phymetroid",
  "exportedAt": "2026-09-19T22:10:00.000Z",
  "logicalW": 640,
  "logicalH": 360,
  "worldScale": 2,
  "status": "final",
  "intent": {
    "zh": "只转重力矢量、不转镜头。I 落体教学 → II 摩擦行走（R4）→ reactionJump → III 任意角重力场。旧 R3 保留在 R1 下方；新摩擦房为 R4（R2 正上方）。",
    "en": "Rotate gravity vector only; camera stays axis-aligned. Teach fall body (I) before friction walk (II in R4). Keep legacy R3 under R1; new friction room is R4 above R2."
  },
  "compat": {
    "fromSchemaVersion": 3,
    "notes": [
      "v4 adds rooms[].solids (explicit rects, default space:local). No macros in v4.",
      "v3 dumps without solids still import: engine falls back to worldSolids.js hardcode.",
      "pickups/gates remain the only pickup/gate source of truth; solids may reference gates via gapGateId.",
      "world = room.x/y + local; space:world allowed for cross-room pieces (e.g. doorframe).",
      "Unknown solid.kind → treat as custom/block. Corridor shared vertical walls omitted; engine skips join seals.",
      "Pixel feel already WORLD_SCALE×2; do not re-scale.",
      "layoutRevision 5: strip full-height R2_doorframe on load; keep the short catch stub under gate_R2_to_R4.",
      "R3 ceiling openings align to R1 pits only (160–240, 400–480). Seal the middle under R1_floorB.",
      "R3 L/R walls stay sealed; join-X skip applies only on the R0–R2 Y band."
    ]
  },
  "sections": {
    "feel": {
      "moveSpeed": 220,
      "airControl": 0.85,
      "jumpVelocity": -550,
      "jumpCutMultiplier": 0.45,
      "gravityY": 1960,
      "maxFallSpeed": 640,
      "coyoteMs": 90,
      "jumpBufferMs": 100,
      "floatNudge": 56
    },
    "gravity": {
      "rotateVectorOnly": true,
      "rotateCamera": false,
      "affects": "allNonFixedBodies",
      "fixedBodiesTag": "fixed",
      "cardinalOnlyUntil": "gravityField",
      "cardinalAxes": [
        "up",
        "down",
        "left",
        "right"
      ],
      "snapDownToNearestAxis": true,
      "defaultDown": "down",
      "magnitudeKey": "feel.gravityY",
      "airLocksDirection": true,
      "airLockRequiresAbility": "gravityFall",
      "changeDirectionRequires": {
        "groundedOrSupported": true,
        "exceptAbility": "gravityField"
      }
    },
    "abilities": {
      "gravityFall": {
        "id": "gravityFall",
        "tier": "I",
        "legacyIds": [
          "gravity"
        ],
        "label": "GRAVITY FALL",
        "grants": {
          "hasGravity": true,
          "canWalk": false,
          "canJump": false,
          "canWallSlide": false,
          "canWallJump": false,
          "canCrawlCeiling": false,
          "canFly": false,
          "gravityDirections": "cardinal",
          "snapDownOnPickup": true,
          "bodyMode": "falling"
        },
        "why": "拾取后立刻变成落体：把「下」拨到最近轴。教学「重力是方向，不是地板」。不能走/跳/贴顶逛；空中锁定重力方向。"
      },
      "surfaceWalk": {
        "id": "surfaceWalk",
        "tier": "II",
        "label": "SURFACE WALK",
        "requires": [
          "gravityFall"
        ],
        "grants": {
          "canWalk": true,
          "hasFriction": true,
          "canWallSlide": true,
          "canJump": false,
          "canWallJump": false,
          "gravityDirections": "cardinal"
        },
        "why": "第一扇真门后的能力。有摩擦，可沿当前「下」行走，可扒墙滑落；仍不能跳（跳属 reactionJump）。"
      },
      "reactionJump": {
        "id": "reactionJump",
        "tier": "II+",
        "label": "REACTION JUMP",
        "requires": [
          "surfaceWalk"
        ],
        "grants": {
          "canJump": true,
          "canWallJump": true,
          "usesFeelJump": true
        },
        "why": "与 surfaceWalk 分开（可紧跟或稍晚）。解锁跳，之后才能扒墙跳。feel 的 jump* / coyote / buffer 从这时起生效。"
      },
      "gravityField": {
        "id": "gravityField",
        "tier": "III",
        "label": "GRAVITY FIELD",
        "requires": [
          "reactionJump"
        ],
        "grants": {
          "gravityDirections": "arbitrary",
          "toggleAnytime": true,
          "adjustableMagnitude": true,
          "airLocksDirection": false
        },
        "why": "中后期。任意角、可随时开、可调 g。镜头仍不转。"
      }
    },
    "player": {
      "maxHp": 3,
      "startingHp": 3,
      "startingAbilities": [],
      "startingItems": {},
      "abilityUnlockOrder": [
        "gravityFall",
        "surfaceWalk",
        "reactionJump",
        "gravityField"
      ]
    },
    "progress": {
      "defaultPhase": "intro",
      "phaseAfterGravity": "exploration",
      "phaseLabels": {
        "intro": "INTRO",
        "exploration": "EXPLORE",
        "frictionLesson": "FRICTION",
        "jumpLesson": "JUMP",
        "boss": "BOSS"
      },
      "abilityPhases": {
        "gravityFall": "exploration",
        "surfaceWalk": "frictionLesson",
        "reactionJump": "jumpLesson",
        "gravityField": "exploration"
      },
      "pathIntent": {
        "zh": [
          "R0：漂浮 → 碰 gravityOrb → 获得 gravityFall（I）。世界重力矢量开启，「下」吸附最近轴；仍不能走/跳。",
          "I 阶段：用四向重力当唯一位移手段（着地时可改方向；空中锁定）。穿过 R1 缺口进入 R2。",
          "R2→R4：R2 顶开通道（第一扇真门，门禁 requireAbility: gravityFall）。右落到门洞右侧短立柱着地，把「下」拨到 up，落体「向上」坠入 R4。门前不得有通高墙。",
          "R4：摩擦房。左上角 surfaceWalk 拾取 → 获得 II。此后可沿当前「下」行走/扒墙滑。",
          "其后（本 JSON 未摆放拾取）：reactionJump → 再后 gravityField（III）。",
          "旧 R3（R1 正下方）保留探索支线，不改 id，不承担摩擦教学。"
        ]
      }
    },
    "rooms": [
      {
        "id": "R0",
        "x": 0,
        "y": 0,
        "w": 640,
        "h": 360,
        "role": "intro",
        "intent": "漂浮拿黄球；教学前厅。",
        "solids": [
          {
            "id": "R0_floor",
            "kind": "floor",
            "space": "local",
            "x": 0,
            "y": 328,
            "w": 640,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R0_wallL",
            "kind": "wall",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 16,
            "h": 360,
            "fixed": true
          },
          {
            "id": "R0_ceil",
            "kind": "ceiling",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 640,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R0_plat",
            "kind": "plat",
            "space": "local",
            "x": 200,
            "y": 200,
            "w": 96,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R0_block",
            "kind": "block",
            "space": "local",
            "x": 400,
            "y": 280,
            "w": 48,
            "h": 48,
            "fixed": true
          }
        ]
      },
      {
        "id": "R1",
        "x": 640,
        "y": 0,
        "w": 640,
        "h": 360,
        "role": "hub",
        "intent": "三段地板坑通旧 R3；左右走廊开口不写共用竖墙。",
        "solids": [
          {
            "id": "R1_floorA",
            "kind": "floor",
            "space": "local",
            "x": 0,
            "y": 328,
            "w": 160,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R1_floorB",
            "kind": "floor",
            "space": "local",
            "x": 240,
            "y": 328,
            "w": 160,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R1_floorC",
            "kind": "floor",
            "space": "local",
            "x": 480,
            "y": 328,
            "w": 160,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R1_ceil",
            "kind": "ceiling",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 640,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R1_platA",
            "kind": "plat",
            "space": "local",
            "x": 80,
            "y": 180,
            "w": 80,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R1_platB",
            "kind": "plat",
            "space": "local",
            "x": 360,
            "y": 140,
            "w": 112,
            "h": 16,
            "fixed": true
          }
        ]
      },
      {
        "id": "R2",
        "x": 1280,
        "y": 0,
        "w": 640,
        "h": 360,
        "role": "preFriction",
        "intent": "顶通道进 R4；门洞右侧短立柱供 I 模式右落蹭地后翻 up。勿在门前放通高墙。",
        "solids": [
          {
            "id": "R2_floor",
            "kind": "floor",
            "space": "local",
            "x": 0,
            "y": 328,
            "w": 640,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R2_wallR",
            "kind": "wall",
            "space": "local",
            "x": 624,
            "y": 0,
            "w": 16,
            "h": 360,
            "fixed": true
          },
          {
            "id": "R2_ceil",
            "kind": "ceiling",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 640,
            "h": 16,
            "fixed": true,
            "gapGateId": "gate_R2_to_R4"
          },
          {
            "id": "R2_platA",
            "kind": "plat",
            "space": "local",
            "x": 120,
            "y": 220,
            "w": 80,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R2_platB",
            "kind": "plat",
            "space": "local",
            "x": 320,
            "y": 160,
            "w": 80,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R2_block",
            "kind": "block",
            "space": "local",
            "x": 480,
            "y": 264,
            "w": 64,
            "h": 64,
            "fixed": true
          },
          {
            "id": "R2_doorframe",
            "kind": "doorframe",
            "space": "local",
            "x": 320,
            "y": 264,
            "w": 24,
            "h": 64,
            "fixed": true
          }
        ]
      },
      {
        "id": "R3",
        "x": 640,
        "y": 360,
        "w": 640,
        "h": 360,
        "role": "legacyPit",
        "intent": "旧坑支线；非摩擦教学。顶开口仅对齐 R1 地板坑（160–240、400–480）；R1_floorB 正下方封死。左右底保持封闭。",
        "solids": [
          {
            "id": "R3_floor",
            "kind": "floor",
            "space": "local",
            "x": 0,
            "y": 328,
            "w": 640,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R3_wallL",
            "kind": "wall",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 16,
            "h": 360,
            "fixed": true
          },
          {
            "id": "R3_wallR",
            "kind": "wall",
            "space": "local",
            "x": 624,
            "y": 0,
            "w": 16,
            "h": 360,
            "fixed": true
          },
          {
            "id": "R3_ceilL",
            "kind": "ceiling",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 160,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R3_ceilM",
            "kind": "ceiling",
            "space": "local",
            "x": 240,
            "y": 0,
            "w": 160,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R3_ceilR",
            "kind": "ceiling",
            "space": "local",
            "x": 480,
            "y": 0,
            "w": 160,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R3_platA",
            "kind": "plat",
            "space": "local",
            "x": 160,
            "y": 160,
            "w": 96,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R3_platB",
            "kind": "plat",
            "space": "local",
            "x": 360,
            "y": 200,
            "w": 96,
            "h": 16,
            "fixed": true
          }
        ]
      },
      {
        "id": "R4",
        "x": 1280,
        "y": -360,
        "w": 640,
        "h": 360,
        "role": "frictionLesson",
        "intent": "摩擦房；左上 surfaceWalk；底缝接 R2 顶门。",
        "solids": [
          {
            "id": "R4_floor",
            "kind": "floor",
            "space": "local",
            "x": 0,
            "y": 328,
            "w": 640,
            "h": 32,
            "fixed": true,
            "gapGateId": "gate_R2_to_R4"
          },
          {
            "id": "R4_ceil",
            "kind": "ceiling",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 640,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R4_wallL",
            "kind": "wall",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 16,
            "h": 360,
            "fixed": true
          },
          {
            "id": "R4_wallR",
            "kind": "wall",
            "space": "local",
            "x": 624,
            "y": 0,
            "w": 16,
            "h": 360,
            "fixed": true
          },
          {
            "id": "R4_platNearOrb",
            "kind": "plat",
            "space": "local",
            "x": 40,
            "y": 56,
            "w": 112,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R4_platMid",
            "kind": "plat",
            "space": "local",
            "x": 280,
            "y": 180,
            "w": 96,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R4_pillar",
            "kind": "wall",
            "space": "local",
            "x": 560,
            "y": 100,
            "w": 16,
            "h": 180,
            "fixed": true
          }
        ]
      }
    ],
    "pickups": [
      {
        "id": "gravityOrb",
        "ability": "gravityFall",
        "roomId": "R0",
        "x": 256,
        "y": 136,
        "color": "#ffeb3b",
        "requires": [],
        "onCollect": {
          "unlockAbility": "gravityFall",
          "addItem": {
            "gravityOrb": 1
          },
          "advancePhase": "exploration",
          "statusBanner": "GRAVITY ON"
        },
        "notes": "坐标对齐现实现：px(128)=256, px(68)=136（相对世界，R0 原点）。legacy 能力名 gravity → gravityFall。"
      },
      {
        "id": "surfaceWalkOrb",
        "ability": "surfaceWalk",
        "roomId": "R4",
        "x": 1320,
        "y": -320,
        "color": "#80cbc4",
        "requires": [
          "gravityFall"
        ],
        "onCollect": {
          "unlockAbility": "surfaceWalk",
          "addItem": {
            "frictionBoots": 1
          },
          "advancePhase": "frictionLesson",
          "statusBanner": "SURFACE WALK"
        },
        "notes": "R4 左上角：房间原点 (1280,-360) + 本地 (40,40)。"
      }
    ],
    "gates": [
      {
        "id": "gate_R2_to_R4",
        "fromRoomId": "R2",
        "toRoomId": "R4",
        "kind": "ceilingPassage",
        "requireAbility": "gravityFall",
        "world": {
          "x": 1520,
          "y": 0,
          "w": 80,
          "h": 16
        },
        "intent": "第一扇真正的门/通道。仅 I 可到：在 R2 着地后将「下」拨到 up，落体穿过顶通道坠入 R4。无 surfaceWalk 时不可走过去。"
      },
      {
        "id": "gate_R1_to_R3",
        "fromRoomId": "R1",
        "toRoomId": "R3",
        "kind": "floorGap",
        "requireAbility": "gravityFall",
        "intent": "旧坑道入口；与摩擦教学无关。"
      }
    ]
  }
};
