/**
 * Baked schemaVersion 4 default from 数值策划 (authoritative dump).
 * Pages-safe JS module (no JSON import attributes).
 * Source: design-contract-v4-layout5-jump-field.json (layoutRevision 5, status final).
 */
export default {
  "schemaVersion": 4,
  "layoutRevision": 5,
  "game": "phymetroid",
  "exportedAt": "2026-09-19T22:42:20.000Z",
  "logicalW": 640,
  "logicalH": 360,
  "worldScale": 2,
  "status": "final",
  "intent": {
    "zh": "只转重力矢量、不转镜头。I→II(R4)→reactionJump(R5 must-jump)→gravityField(R6 stub)。layoutRevision 5。",
    "en": "Vector gravity only. I→II→jump lesson R5→field stub R6. layoutRevision 5."
  },
  "compat": {
    "fromSchemaVersion": 3,
    "notes": [
      "layoutRevision 5: short R2_doorframe local(320,264,24,64); R3 ceil A/B/C; R5/R6 added.",
      "v4 solids data-driven; omitted solids → engine hardcode fallback; empty [] is kept.",
      "corridorJoin skip vertical seals only on Y=0 band (R0–R2–R5–R6); never strip R3 side walls.",
      "gate_R1_to_R3 has no world; gapGateId dig only for gates with world.",
      "Pixel feel already WORLD_SCALE×2; do not re-scale."
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
        "why": "落体；拨「下」到最近轴；空中锁方向。"
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
        "why": "摩擦行走；仍不能跳。"
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
        "why": "跳跃；feel.jump* 从此生效；墙跳可选。"
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
        "why": "任意角 stub；镜头仍不转。"
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
          "R0 黄球 → gravityFall（I）",
          "四向到 R2 → 翻 up → R4 → surfaceWalk（II）",
          "回 R2 东行 R5 → reactionJump → 必须跳过中段缺口",
          "东门 R6 → gravityField（III stub）",
          "旧 R3 支线；门框矮卡位 layoutRevision 5"
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
        "intent": "顶通道进 R4；东开走廊进 R5；矮门框卡位，勿挡 gate。",
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
            "fixed": true,
            "notes": "矮卡位 layoutRevision5；勿恢复旧全高墙"
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
        "intent": "旧坑；顶板三段只留对齐 R1 坑的两洞。左右墙保留。",
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
            "id": "R3_ceilA",
            "kind": "ceiling",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 160,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R3_ceilB",
            "kind": "ceiling",
            "space": "local",
            "x": 240,
            "y": 0,
            "w": 160,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R3_ceilC",
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
      },
      {
        "id": "R5",
        "x": 1920,
        "y": 0,
        "w": 640,
        "h": 360,
        "role": "jumpLesson",
        "intent": "surfaceWalk 后来此拿 reactionJump；中段必须跳过缺口才到东门。",
        "solids": [
          {
            "id": "R5_floorL",
            "kind": "floor",
            "space": "local",
            "x": 0,
            "y": 328,
            "w": 200,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R5_floorR",
            "kind": "floor",
            "space": "local",
            "x": 360,
            "y": 328,
            "w": 280,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R5_ceil",
            "kind": "ceiling",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 640,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R5_platOrb",
            "kind": "plat",
            "space": "local",
            "x": 40,
            "y": 260,
            "w": 96,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R5_ledge",
            "kind": "plat",
            "space": "local",
            "x": 360,
            "y": 240,
            "w": 120,
            "h": 16,
            "fixed": true
          }
        ]
      },
      {
        "id": "R6",
        "x": 2560,
        "y": 0,
        "w": 640,
        "h": 360,
        "role": "fieldStub",
        "intent": "中后期 stub：拿 gravityField；任意角教学后续扩。",
        "solids": [
          {
            "id": "R6_floor",
            "kind": "floor",
            "space": "local",
            "x": 0,
            "y": 328,
            "w": 640,
            "h": 32,
            "fixed": true
          },
          {
            "id": "R6_ceil",
            "kind": "ceiling",
            "space": "local",
            "x": 0,
            "y": 0,
            "w": 640,
            "h": 16,
            "fixed": true
          },
          {
            "id": "R6_wallR",
            "kind": "wall",
            "space": "local",
            "x": 624,
            "y": 0,
            "w": 16,
            "h": 360,
            "fixed": true
          },
          {
            "id": "R6_platHigh",
            "kind": "plat",
            "space": "local",
            "x": 280,
            "y": 160,
            "w": 128,
            "h": 16,
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
        }
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
        }
      },
      {
        "id": "reactionJumpOrb",
        "ability": "reactionJump",
        "roomId": "R5",
        "x": 2000,
        "y": 220,
        "color": "#ff8a65",
        "requires": [
          "surfaceWalk"
        ],
        "onCollect": {
          "unlockAbility": "reactionJump",
          "addItem": {
            "jumpBooster": 1
          },
          "advancePhase": "jumpLesson",
          "statusBanner": "REACTION JUMP"
        },
        "notes": "R5 入口平台；需 II。拿后过 must-jump 缺口。"
      },
      {
        "id": "gravityFieldOrb",
        "ability": "gravityField",
        "roomId": "R6",
        "x": 2880,
        "y": 120,
        "color": "#b39ddb",
        "requires": [
          "reactionJump"
        ],
        "onCollect": {
          "unlockAbility": "gravityField",
          "addItem": {
            "fieldCore": 1
          },
          "advancePhase": "exploration",
          "statusBanner": "GRAVITY FIELD"
        },
        "notes": "R6 高台 stub。"
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
        "intent": "I：R2 着地后「下」=up 坠入 R4。"
      },
      {
        "id": "gate_R1_to_R3",
        "fromRoomId": "R1",
        "toRoomId": "R3",
        "kind": "floorGap",
        "requireAbility": "gravityFall",
        "intent": "旧坑；无 world；洞由 R1 三段地板定义。"
      },
      {
        "id": "gate_R2_to_R5",
        "fromRoomId": "R2",
        "toRoomId": "R5",
        "kind": "corridorJoin",
        "requireAbility": "surfaceWalk",
        "intent": "需 II 东行进跳跃房。"
      },
      {
        "id": "gate_R5_mustJump",
        "fromRoomId": "R5",
        "toRoomId": "R5",
        "kind": "mustJumpGap",
        "requireAbility": "reactionJump",
        "world": {
          "x": 2120,
          "y": 328,
          "w": 160,
          "h": 32
        },
        "intent": "验收：无跳过不去；有 reactionJump 可上 R5_floorR / ledge。"
      },
      {
        "id": "gate_R5_to_R6",
        "fromRoomId": "R5",
        "toRoomId": "R6",
        "kind": "corridorJoin",
        "requireAbility": "reactionJump",
        "intent": "跳过缺口后进 R6 stub。"
      }
    ]
  }
};
