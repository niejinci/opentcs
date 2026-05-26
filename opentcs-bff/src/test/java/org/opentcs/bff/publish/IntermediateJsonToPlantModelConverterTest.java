// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.publish;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.opentcs.access.to.model.PlantModelCreationTO;

/**
 * Unit tests for {@link IntermediateJsonToPlantModelConverter}. Covers at least one positive case
 * for each entity kind (Point / Path / LocationType / Location / Block / Vehicle) plus the typical
 * validation failures called out by S8.
 */
class IntermediateJsonToPlantModelConverterTest {

  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void packsAllSixEntityKinds()
      throws Exception {
    String json = """
        {
          "v": 2,
          "points": [
            {"name": "P1", "type": "HALT_POSITION",
             "pose": {"position": {"x": 100, "y": 200, "z": 0}, "orientationAngle": "NaN"},
             "layout": {"pixelX": 1, "pixelY": 2}, "properties": {"k": "v"}}
          ],
          "paths": [
            {"name": "P1-P2", "srcPointName": "P1", "destPointName": "P2",
             "length": 1234, "maxVelocity": 500, "maxReverseVelocity": 0,
             "locked": false, "properties": {}}
          ],
          "locationTypes": [
            {"name": "LT1", "allowedOperations": ["Load", "Unload"],
             "allowedPeripheralOperations": [],
             "layout": {"locationRepresentation": "LOAD_TRANSFER_GENERIC"},
             "properties": {}}
          ],
          "locations": [
            {"name": "L1", "typeName": "LT1",
             "position": {"x": 300, "y": 400, "z": 0}, "locked": false,
             "links": [{"pointName": "P1", "allowedOperations": ["Load"]}],
             "layout": {"pixelX": 1, "pixelY": 2, "locationRepresentation": "DEFAULT"},
             "properties": {}}
          ],
          "blocks": [
            {"name": "B1", "type": "SINGLE_VEHICLE_ONLY",
             "memberNames": ["P1", "P2", "L1"],
             "layout": {"colorRgb": "#ff8800"}, "properties": {}}
          ],
          "vehicles": [
            {"name": "V1",
             "boundingBox": {"length": 1000, "width": 600, "height": 400},
             "energyLevelThresholdSet": {"energyLevelCritical": 30, "energyLevelGood": 90,
                                          "energyLevelSufficientlyRecharged": 40,
                                          "energyLevelFullyRecharged": 95},
             "maxVelocity": 1000, "maxReverseVelocity": 500, "envelopeKey": "",
             "layout": {"pixelX": 1, "pixelY": 2, "orientationDeg": 0,
                        "routeColorRgb": "#3366cc"},
             "properties": {}}
          ]
        }
        """;
    // Add a second point so the path's destPointName resolves.
    JsonNode payload = mapper.readTree(json);
    ((com.fasterxml.jackson.databind.node.ArrayNode) payload.get("points")).add(
        mapper.readTree(
            "{\"name\": \"P2\", \"type\": \"PARK_POSITION\","
                + " \"pose\": {\"position\": {\"x\": 500, \"y\": 600, \"z\": 0},"
                + " \"orientationAngle\": 0}, \"layout\": {\"pixelX\": 0, \"pixelY\": 0},"
                + " \"properties\": {}}"
        )
    );

    PlantModelCreationTO to = IntermediateJsonToPlantModelConverter.toCreationTO(payload, "demo");

    assertThat(to.getName()).isEqualTo("demo");
    assertThat(to.getPoints()).extracting("name").containsExactly("P1", "P2");
    assertThat(to.getPaths()).hasSize(1);
    assertThat(to.getPaths().get(0).getSrcPointName()).isEqualTo("P1");
    assertThat(to.getPaths().get(0).getDestPointName()).isEqualTo("P2");
    assertThat(to.getLocationTypes()).hasSize(1);
    assertThat(to.getLocationTypes().get(0).getAllowedOperations()).containsExactly(
        "Load", "Unload"
    );
    assertThat(to.getLocations()).hasSize(1);
    assertThat(to.getLocations().get(0).getLinks()).containsKey("P1");
    assertThat(to.getBlocks()).hasSize(1);
    assertThat(to.getBlocks().get(0).getMemberNames()).contains("P1", "P2", "L1");
    assertThat(to.getVehicles()).hasSize(1);
    assertThat(to.getVehicles().get(0).getBoundingBox().getLength()).isEqualTo(1000L);
    // NaN preserved (point P1 had orientationAngle = "NaN").
    assertThat(Double.isNaN(to.getPoints().get(0).getPose().getOrientationAngle())).isTrue();
  }

  @Test
  void rejectsPathPointingAtNonExistentSrcPoint()
      throws Exception {
    String json = """
        {
          "points": [
            {"name": "P1", "type": "HALT_POSITION",
             "pose": {"position": {"x": 0, "y": 0, "z": 0}, "orientationAngle": "NaN"},
             "layout": {"pixelX": 0, "pixelY": 0}, "properties": {}}
          ],
          "paths": [
            {"name": "broken", "srcPointName": "DoesNotExist", "destPointName": "P1",
             "length": 1, "maxVelocity": 0, "maxReverseVelocity": 0, "locked": false,
             "properties": {}}
          ]
        }
        """;
    assertThatThrownBy(
        () -> IntermediateJsonToPlantModelConverter.toCreationTO(mapper.readTree(json), "x")
    )
        .isInstanceOfSatisfying(PublishValidationException.class, ex -> {
          assertThat(ex.getFieldPath()).isEqualTo("paths[0].srcPointName");
          assertThat(ex.getMessage()).contains("DoesNotExist");
        });
  }

  @Test
  void rejectsLocationWithUnknownType()
      throws Exception {
    String json = """
        {
          "locationTypes": [],
          "locations": [
            {"name": "L1", "typeName": "Ghost",
             "position": {"x": 1, "y": 2, "z": 0}, "locked": false, "links": [],
             "layout": {"pixelX": 0, "pixelY": 0, "locationRepresentation": "DEFAULT"},
             "properties": {}}
          ]
        }
        """;
    assertThatThrownBy(
        () -> IntermediateJsonToPlantModelConverter.toCreationTO(mapper.readTree(json), "x")
    )
        .isInstanceOfSatisfying(
            PublishValidationException.class, ex -> assertThat(ex.getFieldPath()).isEqualTo(
                "locations[0].typeName"
            )
        );
  }

  @Test
  void rejectsMalformedHexColor()
      throws Exception {
    String json = """
        {
          "points": [
            {"name": "P1", "type": "HALT_POSITION",
             "pose": {"position": {"x": 0, "y": 0, "z": 0}, "orientationAngle": "NaN"},
             "layout": {"pixelX": 0, "pixelY": 0}, "properties": {}}
          ],
          "blocks": [
            {"name": "B1", "type": "SINGLE_VEHICLE_ONLY", "memberNames": ["P1"],
             "layout": {"colorRgb": "purple"}, "properties": {}}
          ]
        }
        """;
    assertThatThrownBy(
        () -> IntermediateJsonToPlantModelConverter.toCreationTO(mapper.readTree(json), "x")
    )
        .isInstanceOfSatisfying(
            PublishValidationException.class, ex -> assertThat(ex.getFieldPath()).isEqualTo(
                "blocks[0].layout.colorRgb"
            )
        );
  }
}
