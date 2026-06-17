
## model.xml

D:\byd_agv_njc\opentcs\opentcs-kernel\build\install\opentcs-kernel\data\model.xml

## opentcs-kernel log

[20260609-17:07:17-463] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.createTransportOrder(): ------Create order----- TransportOrderCreationTO{name='spa-1780996037436', incompleteName=true, intendedVehicleName='Vehicle-1', destinations=[DestinationCreationTO{destLocationName='Point-20', destOperation='MOVE', name='', properties={}}, DestinationCreationTO{destLocationName='Location-4', destOperation='startCharging', name='', properties={}}], type='-', deadline=+1000000000-12-31T23:59:59.999999999Z, dispensable=false, wrappingSequence='null', dependencyNames=[], peripheralReservationToken='null', properties={}}
[20260609-17:07:17-481] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.createTransportOrder(): Transport order is being created: spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32 -- details: TransportOrder{name=spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32, wrappingSequence=null, type=-, state=RAW, intendedVehicle=TCSObjectReference{referentClass=class org.opentcs.data.model.Vehicle, name=Vehicle-1}, processingVehicle=null, creationTime=2026-06-09T09:07:17.457807Z, deadline=+1000000000-12-31T23:59:59.999999999Z, finishedTime=+1000000000-12-31T23:59:59.999999999Z, dispensable=false, peripheralReservationToken=null, dependencies=[], driveOrders=[DriveOrder{name=spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32-drive-order-0, destination=Point-20:MOVE, transportOrder=TCSObjectReference{referentClass=class org.opentcs.data.order.TransportOrder, name=spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32}, state=PRISTINE, route=null}, DriveOrder{name=spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32-drive-order-1, destination=Location-4:startCharging, transportOrder=TCSObjectReference{referentClass=class org.opentcs.data.order.TransportOrder, name=spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32}, state=PRISTINE, route=null}], currentDriveOrderIndex=-1, currentRouteStepIndex=-1, properties={}, history=ObjectHistory{entries=[Entry{timestamp=2026-06-09T09:07:17.457256200Z, eventCode=tcs:history:orderCreated, supplements=[]}]}}
[20260609-17:07:19-486] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderState(): Transport order's state changes: spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32 -- RAW -> ACTIVE
[20260609-17:07:19-490] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderState(): Transport order's state changes: spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32 -- ACTIVE -> DISPATCHABLE
[20260609-17:07:19-515] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderState(): Transport order's state changes: spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32 -- DISPATCHABLE -> BEING_PROCESSED
[20260609-17:07:19-517] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderProcessingVehicle(): Transport order's processing vehicle changes: spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32 -- null -> Vehicle-1
[20260609-17:07:19-525] INFO    kernelExecutor       o.o.k.workingset.TransportOrderPoolManager.setTransportOrderNextDriveOrder(): Transport order's drive order finished: spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32 -- Point-20:MOVE
[20260609-17:07:19-689] WARNING kernelExecutor       o.o.k.vehicles.DefaultVehicleController.updatePositionWithOrder(): Vehicle-1: Reported position: Point-20, expected one of: [Point-18, Point-17, Point-16]
[20260609-17:07:19-690] INFO    kernelExecutor       o.o.k.workingset.NotificationBuffer.addNotification()  : User notification added: UserNotification{source=Vehicle-1, timestamp=2026-06-09T09:07:19.690908200Z, level=IMPORTANT, text=Vehicle reported an unexpected position ('Point-20') while processing a transport order. Its vehicle driver won't receive further movement commands until the vehicle is forcefully rerouted.}
[20260609-17:07:19-787] INFO    kernelExecutor       o.o.k.workingset.NotificationBuffer.addNotification()  : User notification added: UserNotification{source=Vehicle-1, timestamp=2026-06-09T09:07:19.786826100Z, level=NOTEWORTHY, text=Vehicle state changed to ERROR}

## AGV received order

topic:
VDA/V2.0.0/BYD_11/DP0055/order

```json
{
    "headerId": 306,
    "timestamp": "2026-06-09T09:12:18.295943900Z",
    "version": "2.0.0",
    "manufacturer": "BYD_11",
    "serialNumber": "DP0055",
    "orderId": "spa-178099603743601KTNT5PTFP8DM5DF0PPZF9E32-1",
    "orderUpdateId": 2,
    "nodes": [
        {
            "nodeId": "Point-17",
            "sequenceId": 4,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 21.55,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": -2.3551820031944137
            }
        },
        {
            "nodeId": "Point-16",
            "sequenceId": 6,
            "released": true,
            "actions": [],
            "nodePosition": {
                "x": 19.1,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-15",
            "sequenceId": 8,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 17.25,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-14",
            "sequenceId": 10,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 15.3,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-13",
            "sequenceId": 12,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 13.4,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-12",
            "sequenceId": 14,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 11.5,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-19",
            "sequenceId": 16,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -1.15,
                "mapId": "HZ27",
                "theta": 3.141592653589793
            }
        },
        {
            "nodeId": "Point-11",
            "sequenceId": 18,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -2.8,
                "mapId": "HZ27",
                "theta": -1.5707963267948966
            }
        },
        {
            "nodeId": "Point-10",
            "sequenceId": 20,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -4.1,
                "mapId": "HZ27",
                "theta": -1.5707963267948966
            }
        },
        {
            "nodeId": "Point-9",
            "sequenceId": 22,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 9.85,
                "y": -5.6,
                "mapId": "HZ27",
                "theta": -1.5707963267948966
            }
        },
        {
            "nodeId": "Point-8",
            "sequenceId": 24,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 9.9,
                "y": -7.2,
                "mapId": "HZ27",
                "theta": -1.539556493364628
            }
        },
        {
            "nodeId": "Point-7",
            "sequenceId": 26,
            "released": false,
            "actions": [],
            "nodePosition": {
                "x": 11.4,
                "y": -7.2,
                "mapId": "HZ27",
                "theta": 0
            }
        }
    ],
    "edges": [
        {
            "edgeId": "Point-17 --- Point-16",
            "sequenceId": 5,
            "released": true,
            "startNodeId": "Point-17",
            "endNodeId": "Point-16",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 3.141592653589793,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-16 --- Point-15",
            "sequenceId": 7,
            "released": false,
            "startNodeId": "Point-16",
            "endNodeId": "Point-15",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 3.141592653589793,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-15 --- Point-14",
            "sequenceId": 9,
            "released": false,
            "startNodeId": "Point-15",
            "endNodeId": "Point-14",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 3.141592653589793,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-14 --- Point-13",
            "sequenceId": 11,
            "released": false,
            "startNodeId": "Point-14",
            "endNodeId": "Point-13",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 3.141592653589793,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-13 --- Point-12",
            "sequenceId": 13,
            "released": false,
            "startNodeId": "Point-13",
            "endNodeId": "Point-12",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 3.141592653589793,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-12 --- Point-19",
            "sequenceId": 15,
            "released": false,
            "startNodeId": "Point-12",
            "endNodeId": "Point-19",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 3.141592653589793,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-19 --- Point-11",
            "sequenceId": 17,
            "released": false,
            "startNodeId": "Point-19",
            "endNodeId": "Point-11",
            "actions": [],
            "maxSpeed": 1,
            "orientation": -1.5707963267948966,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-11 --- Point-10",
            "sequenceId": 19,
            "released": false,
            "startNodeId": "Point-11",
            "endNodeId": "Point-10",
            "actions": [],
            "maxSpeed": 1,
            "orientation": -1.5707963267948966,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-10 --- Point-9",
            "sequenceId": 21,
            "released": false,
            "startNodeId": "Point-10",
            "endNodeId": "Point-9",
            "actions": [],
            "maxSpeed": 1,
            "orientation": -1.5707963267948966,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-9 --- Point-8",
            "sequenceId": 23,
            "released": false,
            "startNodeId": "Point-9",
            "endNodeId": "Point-8",
            "actions": [],
            "maxSpeed": 1,
            "orientation": -1.539556493364628,
            "orientationType": "GLOBAL"
        },
        {
            "edgeId": "Point-8 --- Point-7",
            "sequenceId": 25,
            "released": false,
            "startNodeId": "Point-8",
            "endNodeId": "Point-7",
            "actions": [],
            "maxSpeed": 1,
            "orientation": 0,
            "orientationType": "GLOBAL"
        }
    ]
}
```