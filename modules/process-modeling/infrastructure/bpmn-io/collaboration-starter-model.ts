export const collaborationStarterBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_Collaboration_Starter"
  targetNamespace="https://the-experience.blog/bpmn/collaboration-starter">
  <bpmn:collaboration id="Collaboration_Editorial">
    <bpmn:participant id="Participant_Editorial" name="Editorial Team" processRef="Process_Editorial" />
    <bpmn:participant id="Participant_Audience" name="Audience" />
    <bpmn:messageFlow id="Message_Publish_Audience" name="Published story" sourceRef="Task_Publish" targetRef="Participant_Audience" />
  </bpmn:collaboration>
  <bpmn:process id="Process_Editorial" name="Editorial delivery" isExecutable="false">
    <bpmn:laneSet id="LaneSet_Editorial">
      <bpmn:lane id="Lane_Author" name="Author">
        <bpmn:flowNodeRef>Start_Draft</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Write</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Editor" name="Editor">
        <bpmn:flowNodeRef>Task_Publish</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_Published</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_Draft" name="Draft ready">
      <bpmn:outgoing>Flow_Draft_Write</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_Write" name="Refine story">
      <bpmn:incoming>Flow_Draft_Write</bpmn:incoming>
      <bpmn:outgoing>Flow_Write_Publish</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_Publish" name="Publish story">
      <bpmn:incoming>Flow_Write_Publish</bpmn:incoming>
      <bpmn:outgoing>Flow_Publish_End</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_Published" name="Story published">
      <bpmn:incoming>Flow_Publish_End</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Draft_Write" sourceRef="Start_Draft" targetRef="Task_Write" />
    <bpmn:sequenceFlow id="Flow_Write_Publish" sourceRef="Task_Write" targetRef="Task_Publish" />
    <bpmn:sequenceFlow id="Flow_Publish_End" sourceRef="Task_Publish" targetRef="End_Published" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_Collaboration_Starter">
    <bpmndi:BPMNPlane id="Plane_Collaboration_Starter" bpmnElement="Collaboration_Editorial">
      <bpmndi:BPMNShape id="Shape_Participant_Editorial" bpmnElement="Participant_Editorial" isHorizontal="true">
        <dc:Bounds x="80" y="80" width="900" height="300" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_Author" bpmnElement="Lane_Author" isHorizontal="true">
        <dc:Bounds x="110" y="80" width="870" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_Editor" bpmnElement="Lane_Editor" isHorizontal="true">
        <dc:Bounds x="110" y="230" width="870" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Start_Draft" bpmnElement="Start_Draft">
        <dc:Bounds x="170" y="137" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_Write" bpmnElement="Task_Write">
        <dc:Bounds x="270" y="115" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_Publish" bpmnElement="Task_Publish">
        <dc:Bounds x="520" y="265" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End_Published" bpmnElement="End_Published">
        <dc:Bounds x="760" y="287" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Participant_Audience" bpmnElement="Participant_Audience" isHorizontal="true">
        <dc:Bounds x="80" y="470" width="900" height="100" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Draft_Write" bpmnElement="Flow_Draft_Write">
        <di:waypoint x="206" y="155" /><di:waypoint x="270" y="155" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Write_Publish" bpmnElement="Flow_Write_Publish">
        <di:waypoint x="390" y="155" /><di:waypoint x="455" y="155" /><di:waypoint x="455" y="305" /><di:waypoint x="520" y="305" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Publish_End" bpmnElement="Flow_Publish_End">
        <di:waypoint x="640" y="305" /><di:waypoint x="760" y="305" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Message_Audience" bpmnElement="Message_Publish_Audience">
        <di:waypoint x="580" y="345" /><di:waypoint x="580" y="470" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
