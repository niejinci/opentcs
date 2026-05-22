
[toc]
***

## 在`S6.画布编辑器`编辑模型文件

1. 画4个点: Point-1, Point-2, Point-3, Point-4
2. 画3条路径: Point-1 -> Point-2, Point-2 -> Point-3, Point-3 -> Point-4
    - 给路径`Point-1 -> Point-2`设置属性：
        ```
        "edge.maxSpeed": "0.3",
        "vda5050:orientationType.forward": "GLOBAL",
        "vda5050:orientation.forward": "-90"
        ```
    - 给路径`Point-2 -> Point-3`设置属性：
        ```
            "edge.maxSpeed": "0.2",
            "vda5050:orientationType.forward": "GLOBAL",
            "vda5050:orientation.forward": "-90"
        ```
3. 画2个站点: Location-1, Location-2
    - Location-1 连接到 Point-2, typeName 为 LocType-1
    - Location-2 连接到 Point-3, typeName 为 LocType-2
    - 给站点 Location-1设置属性
        ```
        "vda5050:destinationAction.pick.blockingType": "NONE",
        "vda5050:destinationAction.pick.parameter.height": "float:0.04",
        "vda5050:destinationAction.pick.parameter.loadType": "JJ27TY"
        ```
    - 给站点 Location-2设置属性
    ```
    "vda5050:destinationAction.drop.parameter.height": "float:0"
    ```
4. 画一辆车: Vehicle-1
    - 给车 Vehicle-1 设置属性
    ```
    "vda5050:manufacturer": "BYD_11",
    "vda5050:version": "2.0",
    "vda5050:serialNumber": "DP0024"
    ```

## 获取`S6.画布编辑器`保存的模型文件

操作步骤：
`DevTools` → `Application` → `Local Storage` → `opentcs-spa.draftV1` (或 `.draftV2`)，复制出 JSON

opentcs-spa.draftV1
```json
{
    "v": 2,
    "points": [
        {
            "name": "Point-1",
            "type": "HALT_POSITION",
            "pose": {
                "position": {
                    "x": -152188,
                    "y": 78363,
                    "z": 0
                },
                "orientationAngle": null
            },
            "layout": {
                "pixelX": 860.2339332332348,
                "pixelY": 1943.74092362062
            },
            "properties": {}
        },
        {
            "name": "Point-2",
            "type": "HALT_POSITION",
            "pose": {
                "position": {
                    "x": -152119,
                    "y": 53434,
                    "z": 0
                },
                "orientationAngle": null
            },
            "layout": {
                "pixelX": 861.6263329251135,
                "pixelY": 2442.326698442127
            },
            "properties": {}
        },
        {
            "name": "Point-3",
            "type": "HALT_POSITION",
            "pose": {
                "position": {
                    "x": -152980,
                    "y": 36358,
                    "z": 0
                },
                "orientationAngle": null
            },
            "layout": {
                "pixelX": 844.3949320094943,
                "pixelY": 2783.8374624573325
            },
            "properties": {}
        },
        {
            "name": "Point-4",
            "type": "HALT_POSITION",
            "pose": {
                "position": {
                    "x": -154628,
                    "y": 17079,
                    "z": 0
                },
                "orientationAngle": null
            },
            "layout": {
                "pixelX": 811.4493768202674,
                "pixelY": 3169.4291741124266
            },
            "properties": {}
        }
    ],
    "paths": [
        {
            "name": "Path-1",
            "srcPointName": "Point-1",
            "destPointName": "Point-2",
            "length": 24929,
            "maxVelocity": 1000,
            "maxReverseVelocity": 0,
            "locked": false,
            "properties": {
                "edge.maxSpeed": "0.3",
                "vda5050:orientationType.forward": "GLOBAL",
                "vda5050:orientation.forward": "-90"
            }
        },
        {
            "name": "Path-2",
            "srcPointName": "Point-2",
            "destPointName": "Point-3",
            "length": 17098,
            "maxVelocity": 1000,
            "maxReverseVelocity": 0,
            "locked": false,
            "properties": {
                "edge.maxSpeed": "0.2",
                "vda5050:orientationType.forward": "GLOBAL",
                "vda5050:orientation.forward": "-90"
            }
        },
        {
            "name": "Path-3",
            "srcPointName": "Point-3",
            "destPointName": "Point-4",
            "length": 19349,
            "maxVelocity": 1000,
            "maxReverseVelocity": 0,
            "locked": false,
            "properties": {}
        }
    ],
    "locationTypes": [
        {
            "name": "LocType-1",
            "allowedOperations": [
                "pick"
            ],
            "allowedPeripheralOperations": [],
            "layout": {
                "locationRepresentation": "LOAD_TRANSFER_GENERIC"
            },
            "properties": {}
        },
        {
            "name": "LocType-2",
            "allowedOperations": [
                "drop"
            ],
            "allowedPeripheralOperations": [],
            "layout": {
                "locationRepresentation": "LOAD_TRANSFER_GENERIC"
            },
            "properties": {}
        }
    ],
    "locations": [
        {
            "name": "Location-1",
            "typeName": "LocType-1",
            "position": {
                "x": -177182,
                "y": 47981,
                "z": 0
            },
            "locked": false,
            "links": [
                {
                    "pointName": "Point-2",
                    "allowedOperations": []
                }
            ],
            "layout": {
                "pixelX": 360.3594579844208,
                "pixelY": 2551.3775197439872,
                "locationRepresentation": "DEFAULT"
            },
            "properties": {
                "vda5050:destinationAction.pick.blockingType": "NONE",
                "vda5050:destinationAction.pick.parameter.height": "float:0.04",
                "vda5050:destinationAction.pick.parameter.loadType": "JJ27TY"
            }
        },
        {
            "name": "Location-2",
            "typeName": "LocType-2",
            "position": {
                "x": -125190,
                "y": 25427,
                "z": 0
            },
            "locked": false,
            "links": [
                {
                    "pointName": "Point-3",
                    "allowedOperations": []
                }
            ],
            "layout": {
                "pixelX": 1400.2096538967223,
                "pixelY": 3002.467304493733,
                "locationRepresentation": "DEFAULT"
            },
            "properties": {
                "vda5050:destinationAction.drop.parameter.height": "float:0"
            }
        }
    ],
    "blocks": [],
    "vehicles": [
        {
            "name": "Vehicle-1",
            "boundingBox": {
                "length": 1000,
                "width": 1000,
                "height": 1000
            },
            "energyLevelThresholdSet": {
                "energyLevelCritical": 30,
                "energyLevelGood": 90,
                "energyLevelSufficientlyRecharged": 30,
                "energyLevelFullyRecharged": 90
            },
            "maxVelocity": 1000,
            "maxReverseVelocity": 1000,
            "envelopeKey": "",
            "layout": {
                "pixelX": 2388.50690777936,
                "pixelY": 2979.3273685149347,
                "orientationDeg": 0,
                "routeColorRgb": "#0969da"
            },
            "properties": {
                "vda5050:manufacturer": "BYD_11",
                "vda5050:version": "2.0",
                "vda5050:serialNumber": "DP0024"
            }
        }
    ],
    "selection": {
        "kind": "vehicle",
        "name": "Vehicle-1"
    }
}
```